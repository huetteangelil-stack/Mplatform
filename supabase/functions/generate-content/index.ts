import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * generate-content — v1.1 (grounded SMM math + security + validation hardening)
 * ---------------------------------------------------------------------------------------
 * v1.1 changes on top of v1.0:
 *
 *  1. GROUNDED MARKET SIZING (root-cause fix): the "smm_strategy" mode no longer asks the
 *     LLM to compute marketValue or the SOM total itself. It now returns raw numeric inputs
 *     only (tam.potentialCustomers, tam.acv, sam.penetrationOfTam, and som.contributions — a
 *     list of named, individually anchored channel contributions), and every total
 *     (marketValue, sam.potentialCustomers, som.potentialCustomers) is computed in code by
 *     computeMarketSizing(). This makes the kind of TAM/SOM arithmetic mismatch found in
 *     manual review structurally impossible, instead of just discouraged by prompt wording.
 *
 *  2. RESPECTS UPSTREAM GROUNDING: reads generate-strategy's tactics[] anchor fields
 *     (source-tagged quote vs the literal "estimate") and splits them into a "SOURCED
 *     FACTS" vs "PLANNING ESTIMATES" block in the prompt, so the model is told explicitly
 *     which figures it may treat as proven. Falls back gracefully (treats as estimated) if
 *     the incoming strategy predates that change and tactics are still plain strings.
 *
 *  v1.2 update: generate-strategy v2.4 removed kpis[] (replaced by prospectingKit, which is
 *     shown directly to the user rather than fed into market sizing). This function now
 *     reads ONLY tactics[] for grounding — a strategy generated before v2.4 still works
 *     identically; a strategy generated after v2.4 simply has one fewer source of anchored
 *     figures, which tactics[] alone still covers reasonably well.
 *
 *  3. VALIDATION + RETRY for "smm_strategy": validateSmmOutput() checks the raw numeric
 *     fields and som.contributions before totals are computed; one corrective retry on
 *     failure, mirroring generate-strategy's pattern. Other modes (topics/drafts/hooks/
 *     icp_insights) are not restructured, beyond point 4 below.
 *
 *  4. ROBUST JSON EXTRACTION: the old regex-based extractJson (could mis-extract on nested
 *     brackets) is replaced by extractJsonValue, a bracket-counting parser that correctly
 *     handles a top-level JSON object OR array.
 *
 *  5. SECURITY: same auth + per-user daily quota guard as generate-strategy v2.2, using its
 *     OWN `content_generation_quota` table (kept separate from generate-strategy's quota,
 *     since this endpoint is called far more often per session — one strategy can trigger
 *     many topics/drafts/hooks/icp_insights/smm_strategy calls). CORS origin is now
 *     configurable via ALLOWED_ORIGIN instead of a hardcoded "*".
 *
 *  6. TEMPERATURE: "smm_strategy" and "icp_insights" (both must stay strictly grounded in
 *     the strategy, not creative) now run at 0.3 instead of 0.8. "topics"/"drafts"/"hooks"
 *     stay creative at 0.8.
 *
 * New table required (run once):
 *
 *   CREATE TABLE IF NOT EXISTS content_generation_quota (
 *     user_id uuid NOT NULL,
 *     day date NOT NULL,
 *     count integer NOT NULL DEFAULT 0,
 *     PRIMARY KEY (user_id, day)
 *   );
 *
 * New env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected), ALLOWED_ORIGIN
 * (optional, defaults to "*" — set it in production).
 *
 * Front-end changes needed: send `Authorization: Bearer <user JWT>`; read tam/sam/som
 * `marketValue` and `potentialCustomers` as PLAIN NUMBERS now (format with toLocaleString()
 * on display) instead of pre-formatted strings; optionally surface `basedOnEstimates` on
 * each tier and `som.contributions` / `*Anchor` fields as a "to validate" badge.
 */

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*"; // v1.1: set this in production instead of "*"
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DAILY_CONTENT_QUOTA = 150; // v1.1: separate, higher-volume quota than generate-strategy
const SMM_MAX_TOKENS = 5000; // v1.1: bumped from 4000 — anchors + contributions add tokens

interface ContentRequest {
  mode: "topics" | "drafts" | "hooks" | "icp_insights" | "smm_strategy";
  contentType?: "educational";
  postType?: "POV" | "TIPS";
  selectedTopic?: string;
  selectedDraft?: string;
  strategy: Record<string, unknown>;
}

// v1.1: bracket-counting extractor, replaces the regex-based extractJson. Handles a
// top-level JSON object {...} or array [...], and won't get confused by nested brackets
// inside strings the way a naive regex match can.
function extractJsonValue(content: string): unknown | null {
  const text = content.replace(/```(?:json)?/gi, "").trim();
  const start = text.search(/[\[{]/);
  if (start === -1) return null;
  const openChar = text[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// v1.1: tolerant number coercion — the model is instructed to return plain numbers, but this
// guards against an occasional "3 600" / "3600€" style string slipping through anyway.
function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// v1.2: separates generate-strategy's tactics[] into what's actually sourced vs what is a
// bare planning assumption, based on each item's "anchor" field. Handles the pre-v2.2 shape
// (plain strings, no anchor) by treating those as estimated, since there is no way to know
// otherwise. kpis[] is no longer scanned — generate-strategy v2.4 removed it.
function splitGroundedVsEstimated(strategy: Record<string, unknown>): { grounded: string[]; estimated: string[] } {
  const grounded: string[] = [];
  const estimated: string[] = [];
  const scan = (arr: unknown, textField: string) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (typeof item === "string") {
        estimated.push(item); // pre-v2.2 shape: no anchor info available
        continue;
      }
      if (item && typeof item === "object") {
        const text = String((item as any)[textField] ?? "");
        const anchor = (item as any).anchor;
        if (typeof anchor === "string" && anchor.trim() && anchor.trim().toLowerCase() !== "estimate") {
          grounded.push(text + " [source: " + anchor.trim() + "]");
        } else {
          estimated.push(text);
        }
      }
    }
  };
  scan((strategy as any)?.tactics, "tactic");
  return { grounded, estimated };
}

function buildGroundedBlock(strategy: Record<string, unknown>): string {
  const { grounded, estimated } = splitGroundedVsEstimated(strategy);
  return [
    "=== SOURCED FACTS (traceable to the company's site/SERP/LinkedIn — safe to build numbers on) ===",
    grounded.length ? grounded.map((g) => "- " + g).join("\n") : "(none)",
    "",
    "=== PLANNING ESTIMATES (no supporting evidence in the dossier — treat as assumptions, not facts) ===",
    estimated.length ? estimated.map((e) => "- " + e).join("\n") : "(none)",
  ].join("\n");
}

// v1.1: validates the RAW model output for smm_strategy, before any totals are computed.
function validateSmmOutput(s: any): string[] {
  const problems: string[] = [];
  if (!s || typeof s !== "object") return ["root is not an object"];
  if (coerceNumber(s.tam?.potentialCustomers) === null) problems.push("tam.potentialCustomers");
  if (coerceNumber(s.tam?.acv) === null) problems.push("tam.acv");
  if (coerceNumber(s.sam?.penetrationOfTam) === null) problems.push("sam.penetrationOfTam");
  if (!Array.isArray(s.som?.contributions) || s.som.contributions.length < 2) {
    problems.push("som.contributions (array >= 2)");
  } else {
    s.som.contributions.forEach((c: any, i: number) => {
      if (coerceNumber(c?.customers) === null) problems.push("som.contributions[" + i + "].customers");
      if (typeof c?.anchor !== "string" || !c.anchor.trim()) problems.push("som.contributions[" + i + "].anchor");
    });
  }
  if (!Array.isArray(s.personas) || s.personas.length < 2) problems.push("personas (array >= 2)");
  return problems;
}

// v1.1: the actual arithmetic — done once, in code, instead of trusted to the model.
//  - tam.marketValue     = tam.potentialCustomers x tam.acv
//  - sam.potentialCustomers = tam.potentialCustomers x (sam.penetrationOfTam / 100)   [derived FROM tam, not independently invented]
//  - sam.marketValue     = sam.potentialCustomers x sam.acv
//  - som.potentialCustomers = SUM(som.contributions[].customers)                      [this is the fix for the reconciliation bug]
//  - som.marketValue     = som.potentialCustomers x som.acv
function computeMarketSizing(raw: any): any {
  const isEstimate = (a: unknown) => typeof a === "string" && a.trim().toLowerCase() === "estimate";

  const tamCustomers = coerceNumber(raw?.tam?.potentialCustomers) ?? 0;
  const tamAcv = coerceNumber(raw?.tam?.acv) ?? 0;
  const tamMarketValue = tamCustomers * tamAcv;
  const tamEstimated = isEstimate(raw?.tam?.customersAnchor) || isEstimate(raw?.tam?.acvAnchor);

  const penetration = coerceNumber(raw?.sam?.penetrationOfTam) ?? 0;
  const samCustomers = Math.round(tamCustomers * (penetration / 100));
  const samAcv = coerceNumber(raw?.sam?.acv) ?? tamAcv;
  const samMarketValue = samCustomers * samAcv;
  const samEstimated = tamEstimated || isEstimate(raw?.sam?.penetrationAnchor) || isEstimate(raw?.sam?.acvAnchor);

  const contributions = Array.isArray(raw?.som?.contributions) ? raw.som.contributions : [];
  const somCustomers = contributions.reduce((sum: number, c: any) => sum + (coerceNumber(c?.customers) ?? 0), 0);
  const somAcv = coerceNumber(raw?.som?.acv) ?? tamAcv;
  const somMarketValue = somCustomers * somAcv;
  const somEstimated =
    contributions.some((c: any) => isEstimate(c?.anchor)) || isEstimate(raw?.som?.acvAnchor);

  return {
    tam: {
      description: raw?.tam?.description ?? "",
      potentialCustomers: tamCustomers,
      customersAnchor: raw?.tam?.customersAnchor ?? "estimate",
      acv: tamAcv,
      acvAnchor: raw?.tam?.acvAnchor ?? "estimate",
      marketValue: tamMarketValue, // computed here, never trusted from the model
      rationale: raw?.tam?.rationale ?? "",
      basedOnEstimates: tamEstimated,
    },
    sam: {
      description: raw?.sam?.description ?? "",
      potentialCustomers: samCustomers, // derived in code FROM tam.potentialCustomers x penetration
      penetrationOfTam: penetration,
      penetrationAnchor: raw?.sam?.penetrationAnchor ?? "estimate",
      acv: samAcv,
      acvAnchor: raw?.sam?.acvAnchor ?? "estimate",
      marketValue: samMarketValue,
      rationale: raw?.sam?.rationale ?? "",
      basedOnEstimates: samEstimated,
    },
    som: {
      description: raw?.som?.description ?? "",
      contributions,
      potentialCustomers: somCustomers, // computed here as SUM(contributions[].customers) — the reconciliation fix
      acv: somAcv,
      acvAnchor: raw?.som?.acvAnchor ?? "estimate",
      marketValue: somMarketValue,
      rationale: raw?.som?.rationale ?? "",
      basedOnEstimates: somEstimated,
    },
    personas: Array.isArray(raw?.personas) ? raw.personas : [],
  };
}

function buildSmmPrompt(strategy: string, groundedBlock: string): string {
  return `You are Elsa, an expert go-to-market strategist. Using ONLY the marketing strategy and ICP below, produce the RAW INPUTS for a market sizing and buyer persona analysis. Do not invent business details that contradict the strategy.

${groundedBlock}

IMPORTANT — NUMBERS ONLY, NO ARITHMETIC BY YOU:
Do not compute totals, products, or market values yourself. Return only the raw numeric inputs (customer counts, ACV, percentages) with their justification. All multiplication and summation will be done in code from the numbers you provide, so consistency between your "rationale" text and the numbers you output matters far more than a polished-looking final figure — there will be no final figure for you to polish.

Return ONLY a JSON object with this EXACT structure (no markdown, no code fences). All numeric fields must be plain numbers: no currency symbols, no thousands separators, no surrounding text.

{
  "tam": {
    "description": "What the Total Addressable Market represents for this business (1-2 sentences)",
    "potentialCustomers": <number>,
    "customersAnchor": "source-tagged quote from the SOURCED FACTS block above, or the exact string 'estimate'",
    "acv": <number, annual contract value in EUR>,
    "acvAnchor": "source-tagged quote, or the exact string 'estimate'",
    "rationale": "2-3 sentences explaining the assumptions behind potentialCustomers and acv"
  },
  "sam": {
    "description": "What the Serviceable Available Market represents given this business's model, geography and capabilities (1-2 sentences)",
    "penetrationOfTam": <number 0-100, the percentage of TAM realistically reachable through this business's actual channels>,
    "penetrationAnchor": "source-tagged quote, or the exact string 'estimate'",
    "acv": <number, usually the same as tam.acv unless you justify a difference>,
    "acvAnchor": "source-tagged quote, or the exact string 'estimate'",
    "rationale": "2-3 sentences explaining which segments of the TAM are excluded and why"
  },
  "som": {
    "description": "What the Serviceable Obtainable Market represents — the realistic short-term capture (1-2 sentences)",
    "contributions": [
      { "source": "short label for this acquisition channel or mechanism, drawn from the strategy's tactics/KPIs", "customers": <number of new customers this channel realistically brings in year 1>, "anchor": "source-tagged quote, or the exact string 'estimate'" }
    ],
    "acv": <number, usually the same as tam.acv unless you justify a difference>,
    "acvAnchor": "source-tagged quote, or the exact string 'estimate'",
    "rationale": "2-3 sentences on competition, traction and capture assumptions — this rationale MUST be consistent with the sum of 'contributions', since that sum (not a separately imagined number) is what will be used as the final SOM figure"
  },
  "personas": [
    { "name": "Persona name (e.g. 'Sarah the CEO')", "role": "Job title / role", "description": "1-2 sentence summary of who this persona is", "motivations": ["3-4 key motivations"], "painPoints": ["3-4 specific pain points"], "kpis": ["3-4 KPIs they are responsible for"], "responsibilities": ["3-4 key responsibilities"], "reportingTo": "Who they report to", "buyingRole": "Their role in the buying process (e.g. decision-maker, influencer, champion)" },
    { "name": "Second persona name", "role": "...", "description": "...", "motivations": ["..."], "painPoints": ["..."], "kpis": ["..."], "responsibilities": ["..."], "reportingTo": "...", "buyingRole": "..." }
  ]
}

Provide 2 to 5 "contributions" entries for the SOM, each tied to a real channel or mechanism named in the strategy's tactics or KPIs (a lead-gen channel, a partner/franchise network, existing pipeline, etc.) — do not invent a channel that isn't grounded in the strategy or explicitly tagged "estimate". Generate exactly 2 distinct buyer personas, specific to the ICP and business context.

Marketing strategy:
${strategy}`;
}

async function callDeepSeek(messages: { role: string; content: string }[], temperature: number, maxTokens: number): Promise<string> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("DEEPSEEK_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("DeepSeek returned an empty response");
  return content;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // -------------------------------------------------------------------------
  // v1.1: auth guard, BEFORE any paid DeepSeek call. Same pattern as
  // generate-strategy v2.2, but its own quota table (content generation is called
  // far more often per session). Fails open (unauthenticated allowed) only if
  // SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY aren't set at all — set both in prod.
  // -------------------------------------------------------------------------
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAdmin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

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
    const userId = userData.user.id;

    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: quotaRow, error: quotaErr } = await supabaseAdmin
        .from("content_generation_quota")
        .select("count")
        .eq("user_id", userId)
        .eq("day", today)
        .maybeSingle();
      if (!quotaErr) {
        const current = quotaRow?.count ?? 0;
        if (current >= DAILY_CONTENT_QUOTA) {
          return new Response(JSON.stringify({ error: "Daily generation quota exceeded" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await supabaseAdmin
          .from("content_generation_quota")
          .upsert({ user_id: userId, day: today, count: current + 1 }, { onConflict: "user_id,day" });
      }
    } catch (quotaEx) {
      console.warn("content_generation_quota check skipped:", quotaEx);
    }
  } else {
    console.warn("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — auth/quota guard disabled.");
  }
  // --- end v1.1 auth guard ---

  try {
    const body = await req.json() as ContentRequest;
    if (body.mode !== "topics" && body.mode !== "drafts" && body.mode !== "hooks" && body.mode !== "icp_insights" && body.mode !== "smm_strategy") {
      return new Response(JSON.stringify({ error: "Invalid generation mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!body.strategy) {
      return new Response(JSON.stringify({ error: "A strategy is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.mode !== "icp_insights" && body.mode !== "smm_strategy" && body.contentType !== "educational") {
      return new Response(JSON.stringify({ error: "Supported content type is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if ((body.mode === "drafts" || body.mode === "hooks") && (!body.selectedTopic || !body.postType)) {
      return new Response(JSON.stringify({ error: "A topic and post type are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.mode === "hooks" && !body.selectedDraft) {
      return new Response(JSON.stringify({ error: "A selected draft is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const strategy = JSON.stringify(body.strategy);

    // v1.1: smm_strategy gets its own prompt builder (grounded block + numbers-only schema).
    // The other four modes keep their original prompts, verbatim.
    const prompt = body.mode === "smm_strategy"
      ? buildSmmPrompt(strategy, buildGroundedBlock(body.strategy))
      : body.mode === "icp_insights"
      ? `You are Elsa, an expert customer research strategist. Using only the complete marketing strategy below, generate exactly 12 customer insights for this ideal customer profile. Do not change, contradict, or invent the business context. Return ONLY a JSON object with this exact structure: {"groups":[{"title":"Customer overview","items":[{"title":"Jobs-to-be-Done","description":"...","count":1}]},{"title":"Goals, challenges & motivation","items":[{"title":"Problems","description":"..."},{"title":"Pain points and frustrations","description":"...","count":3},{"title":"Decision triggers","description":"...","count":2}]},{"title":"Buying behavior","items":[{"title":"Alternative solutions","description":"..."},{"title":"Existing knowledge","description":"..."},{"title":"Buying criteria","description":"...","count":2}]},{"title":"Marketing and communication","items":[{"title":"Best channels to reach customers","description":"...","count":1},{"title":"20+ places where customers spend time","description":"...","count":2},{"title":"Preferred communication channels","description":"..."},{"title":"Essential tools","description":"..."},{"title":"Information sources buyer trusts","description":"...","count":1}]}]}. The four groups must contain exactly 1, 3, 3, and 5 items, for exactly 12 total. Each description should be specific, practical, and based on the ICP demographics, psychographics, pain points, goals, problems, needs, benefits, channels, tactics, and KPIs. Counts are optional small integers representing the number of concrete insights in that row. Do not use markdown or extra text.\n\nMarketing strategy:\n${strategy}`
      : body.mode === "topics"
      ? `You are Elsa, an expert B2B content strategist. Create exactly 3 distinct educational content topic ideas for the business described in the strategy below. The topics must be specific, practical, credible, and suitable for a ${body.postType} post. Use all relevant business context, ideal customer profile, needs, problems, channels, tactics, and goals from the strategy. Do not invent a different business. Return ONLY a JSON array of 3 strings, with no markdown or extra text.\n\nStrategy:\n${strategy}`
      : body.mode === "drafts"
        ? `You are Elsa, an expert B2B content writer. Create exactly 3 different educational ${body.postType} post drafts for the selected topic and the complete business strategy below. Each draft must be at least 2,000 characters long, useful, specific, and ready to publish. Each must include a strong opening hook, a clear structure, concrete advice, and a concise call to action. The three drafts must use different angles and wording. Return ONLY a JSON array with exactly 3 objects, each using these fields: {"title":"short title","body":"at least 2000 characters of complete post text","callToAction":"one concise CTA"}. Do not use markdown code fences or extra text.\n\nSelected topic: ${body.selectedTopic}\n\nStrategy:\n${strategy}`
        : `You are Elsa, an expert B2B content editor. Generate exactly 3 short, strong opening hooks for the selected draft below. Hooks must be different, specific to the business and topic, and suitable for the first two lines of a ${body.postType} post. Return ONLY a JSON array of 3 strings, with no markdown or extra text.\n\nSelected topic: ${body.selectedTopic}\n\nSelected draft:\n${body.selectedDraft}\n\nStrategy:\n${strategy}`;

    // v1.1: smm_strategy and icp_insights must stay grounded, not creative.
    const temperature = (body.mode === "smm_strategy" || body.mode === "icp_insights") ? 0.3 : 0.8;
    const maxTokens = body.mode === "topics" ? 1200 : body.mode === "drafts" ? 10000 : body.mode === "icp_insights" ? 3000 : body.mode === "smm_strategy" ? SMM_MAX_TOKENS : 1200;

    const rawContent = await callDeepSeek([{ role: "user", content: prompt }], temperature, maxTokens);
    const parsed = extractJsonValue(rawContent);

    if (body.mode !== "smm_strategy") {
      if (parsed === null) throw new Error("Failed to parse model output as JSON");
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // v1.1: smm_strategy only — validate raw numeric inputs, one corrective retry, then
    // compute every total in code (see computeMarketSizing for the actual arithmetic).
    let smmRaw = parsed;
    let validation = smmRaw ? validateSmmOutput(smmRaw) : ["invalid JSON"];

    if (!smmRaw || validation.length) {
      const fixContent = await callDeepSeek(
        [
          { role: "user", content: prompt },
          { role: "assistant", content: rawContent || "(empty)" },
          {
            role: "user",
            content: smmRaw
              ? "The JSON you returned is invalid or incomplete. Missing/invalid paths: " + validation.join("; ") + ". Return the COMPLETE corrected JSON object only, with numeric fields as plain numbers. No markdown."
              : "Your previous answer was not valid JSON. Return ONLY the complete JSON object requested, no markdown, no code fences.",
          },
        ],
        0.3,
        SMM_MAX_TOKENS,
      );
      const fixedParsed = extractJsonValue(fixContent);
      if (fixedParsed) {
        const fixedProblems = validateSmmOutput(fixedParsed);
        if (fixedProblems.length <= validation.length) {
          smmRaw = fixedParsed;
          validation = fixedProblems;
        }
      }
    }
    if (!smmRaw) throw new Error("Failed to parse SMM strategy JSON");

    const computed = computeMarketSizing(smmRaw);

    return new Response(
      JSON.stringify({
        ...computed,
        _meta: {
          validationWarnings: validation,
          generatedAt: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Content generation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
