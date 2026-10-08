import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * scrape-technology — v1.1 (confirmed input schema)
 * ---------------------------------------------------------------------------------------
 * v1.1: the Actor's real input schema is now confirmed from its own "API client" code
 * sample: { "startDomains": ["example.com"], "maxRequestsPerCrawl": <number> } — a bare
 * domain (no https://, no path), not a URL. The defensive multi-field-name guess from v1.0
 * is removed; runTechScraper() now sends exactly this shape.
 *
 * New function. Launches the Apify "technology scraper" Actor (the one behind
 * https://api.apify.com/v2/actor-runs/bz9vZiuLXXIif9R1Z — that URL was a single past RUN,
 * not reusable; its actId, eFu56JAhgAGsIXfT4, is the reusable Actor this function calls)
 * against a given website, and returns the detected technology stack as a flat array of
 * { name, tag, categories, link }, matching the Actor's own dataset item shape.
 *
 * Auth: dashboard-only (this is only ever called from SmmStrategiesPage, which sits behind
 * DashboardLayout's session check) — same hard-gate + per-user daily quota pattern as
 * generate-content.ts, reusing ITS OWN quota table so a burst of tech scrapes can't starve
 * content-generation quota or vice versa.
 *
 * Persistence (optional, best-effort): pass `strategyId` (the marketing_strategies row id)
 * to have the result saved into that row's `tech_stack` jsonb column, so the page doesn't
 * need to re-run the scraper on every reload. Omit it to just get the result back without
 * saving (e.g. for an ad-hoc check).
 *
 * New table required (run once):
 *
 *   CREATE TABLE IF NOT EXISTS tech_scrape_quota (
 *     user_id uuid NOT NULL,
 *     day date NOT NULL,
 *     count integer NOT NULL DEFAULT 0,
 *     PRIMARY KEY (user_id, day)
 *   );
 *
 * New column required on the existing `marketing_strategies` table (run once):
 *
 *   ALTER TABLE marketing_strategies ADD COLUMN IF NOT EXISTS tech_stack jsonb;
 *
 * Env vars: APIFY_API_KEY (already registered per the user), SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY (auto-injected), ALLOWED_ORIGIN (optional), TECH_SCRAPER_ACTOR_ID
 * (optional override — defaults to the known actId eFu56JAhgAGsIXfT4),
 * TECH_SCRAPER_MAX_REQUESTS (optional override of MAX_REQUESTS_PER_CRAWL below).
 */

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_ACTOR_ID = "eFu56JAhgAGsIXfT4"; // the Actor behind the sample run the user shared
const ACTOR_WAIT_SECONDS = 30; // the sample run finished in ~2.4s; 30s is a generous budget
const DAILY_SCRAPE_QUOTA = 50;
// v1.1: the Actor's own example uses 10000000 (effectively "crawl the whole site"), which
// risks long runs and higher PAY_PER_EVENT cost (one dataset item = one charge) for what we
// need here — a technology profile, not an exhaustive site crawl. Starting conservative;
// raise via TECH_SCRAPER_MAX_REQUESTS if the detection coverage feels too shallow.
const DEFAULT_MAX_REQUESTS_PER_CRAWL = 20;

interface TechScrapeRequest {
  website: string;
  strategyId?: string; // optional: marketing_strategies row id, to persist the result
}

interface TechItem {
  name: string;
  tag: string;
  categories: string[];
  link: string;
}

function envFirst(names: string[]): string | undefined {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeWebsite(input: string): { full: string; domain: string } {
  let full = input.trim();
  if (!/^https?:\/\//i.test(full)) full = "https://" + full;
  try {
    const u = new URL(full);
    return { full: u.href, domain: u.hostname.replace(/^www\./, "") };
  } catch {
    return { full, domain: input.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] };
  }
}

// Same pattern as apifyLinkedInCompany in generate-strategy.ts: start the run, wait, poll
// once more if needed, then fetch the dataset. This Actor is much faster (~2-3s observed),
// so the waits here are shorter.
async function runTechScraper(website: string, token: string, actorId: string, maxRequestsPerCrawl: number): Promise<TechItem[] | null> {
  const { domain } = normalizeWebsite(website);
  // Confirmed shape from the Actor's own API client sample: a bare domain (no https://), in
  // an array, plus a crawl-depth budget.
  const input = { startDomains: [domain], maxRequestsPerCrawl };

  const startRun = async () => {
    try {
      return await fetch(
        `https://api.apify.com/v2/acts/${actorId}/runs?token=${encodeURIComponent(token)}&waitForFinish=${ACTOR_WAIT_SECONDS}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout((ACTOR_WAIT_SECONDS + 10) * 1000),
        },
      );
    } catch {
      return null;
    }
  };

  const res = await startRun();
  if (!res || !res.ok) return null;

  let run: any = await res.json();
  let runId: string | undefined = run?.data?.id;
  let status: string | undefined = run?.data?.status;
  if (!runId) return null;

  if (status && !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    try {
      const poll = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}&waitForFinish=20`,
        { signal: AbortSignal.timeout(25000) },
      );
      if (poll.ok) {
        run = await poll.json();
        status = run?.data?.status;
      }
    } catch { /* ignore */ }
  }
  if (status !== "SUCCEEDED") return null;

  try {
    const itemsRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!itemsRes.ok) return null;
    const items = await itemsRes.json();
    if (!Array.isArray(items)) return null;
    return items.map((it: any) => ({
      name: String(it?.name ?? ""),
      tag: String(it?.tag ?? ""),
      categories: Array.isArray(it?.categories) ? it.categories.map(String) : [],
      link: String(it?.link ?? ""),
    })).filter((it) => it.name);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // --- auth guard, dashboard-only: same hard-gate pattern as generate-content.ts ---
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAdmin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
  let userId: string | null = null;

  if (supabaseAdmin) {
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    userId = userData.user.id;

    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: quotaRow, error: quotaErr } = await supabaseAdmin
        .from("tech_scrape_quota")
        .select("count")
        .eq("user_id", userId)
        .eq("day", today)
        .maybeSingle();
      if (!quotaErr) {
        const current = quotaRow?.count ?? 0;
        if (current >= DAILY_SCRAPE_QUOTA) {
          return new Response(JSON.stringify({ error: "Daily scrape quota exceeded" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await supabaseAdmin
          .from("tech_scrape_quota")
          .upsert({ user_id: userId, day: today, count: current + 1 }, { onConflict: "user_id,day" });
      }
    } catch (quotaEx) {
      console.warn("tech_scrape_quota check skipped:", quotaEx);
    }
  } else {
    console.warn("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — auth/quota guard disabled.");
  }
  // --- end auth guard ---

  try {
    const body = await req.json() as TechScrapeRequest;
    if (!body.website || typeof body.website !== "string") {
      return new Response(JSON.stringify({ error: "A website is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apifyKey = envFirst(["APIFY_API_KEY", "APIFY-API-KEY", "APIFYAPIKEY"]);
    if (!apifyKey) {
      return new Response(JSON.stringify({ error: "APIFY_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const actorId = envFirst(["TECH_SCRAPER_ACTOR_ID"]) || DEFAULT_ACTOR_ID;
    const maxRequestsPerCrawl = Number(envFirst(["TECH_SCRAPER_MAX_REQUESTS"])) || DEFAULT_MAX_REQUESTS_PER_CRAWL;

    const items = await runTechScraper(body.website, apifyKey, actorId, maxRequestsPerCrawl);
    if (!items) {
      return new Response(JSON.stringify({ error: "Technology scan failed or returned no data" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Best-effort persistence — never blocks or fails the response.
    if (supabaseAdmin && body.strategyId) {
      try {
        await supabaseAdmin
          .from("marketing_strategies")
          .update({ tech_stack: items })
          .eq("id", body.strategyId);
      } catch (persistEx) {
        console.warn("tech_stack persistence skipped:", persistEx);
      }
    }

    return new Response(
      JSON.stringify({ items, scrapedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Technology scan failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
