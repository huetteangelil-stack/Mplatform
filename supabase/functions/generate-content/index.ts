import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ContentRequest {
  mode: "topics" | "drafts" | "hooks" | "icp_insights" | "smm_strategy";
  contentType?: "educational";
  postType?: "POV" | "TIPS";
  selectedTopic?: string;
  selectedDraft?: string;
  strategy: Record<string, unknown>;
}

const extractJson = (content: string): unknown => {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
  return JSON.parse(match ? match[0] : cleaned);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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
    const prompt = body.mode === "icp_insights"
      ? `You are Elsa, an expert customer research strategist. Using only the complete marketing strategy below, generate exactly 12 customer insights for this ideal customer profile. Do not change, contradict, or invent the business context. Return ONLY a JSON object with this exact structure: {"groups":[{"title":"Customer overview","items":[{"title":"Jobs-to-be-Done","description":"...","count":1}]},{"title":"Goals, challenges & motivation","items":[{"title":"Problems","description":"..."},{"title":"Pain points and frustrations","description":"...","count":3},{"title":"Decision triggers","description":"...","count":2}]},{"title":"Buying behavior","items":[{"title":"Alternative solutions","description":"..."},{"title":"Existing knowledge","description":"..."},{"title":"Buying criteria","description":"...","count":2}]},{"title":"Marketing and communication","items":[{"title":"Best channels to reach customers","description":"...","count":1},{"title":"20+ places where customers spend time","description":"...","count":2},{"title":"Preferred communication channels","description":"..."},{"title":"Essential tools","description":"..."},{"title":"Information sources buyer trusts","description":"...","count":1}]}]}. The four groups must contain exactly 1, 3, 3, and 5 items, for exactly 12 total. Each description should be specific, practical, and based on the ICP demographics, psychographics, pain points, goals, problems, needs, benefits, channels, tactics, and KPIs. Counts are optional small integers representing the number of concrete insights in that row. Do not use markdown or extra text.\n\nMarketing strategy:\n${strategy}`
      : body.mode === "smm_strategy"
        ? `You are Elsa, an expert go-to-market strategist. Using ONLY the marketing strategy and ICP below, generate a complete market sizing and buyer persona analysis. Do not invent business details that contradict the strategy.\n\nReturn ONLY a JSON object with this EXACT structure (no markdown, no code fences):\n{\n  "tam": {\n    "description": "What the Total Addressable Market represents for this business (1-2 sentences)",\n    "potentialCustomers": "Estimated number of potential customers globally or in the full market",\n    "acv": "Estimated annual contract value or average deal size in USD",\n    "marketValue": "TAM market value in USD (potential customers x ACV)",\n    "rationale": "2-3 sentences explaining the calculation and assumptions\"\n  },\n  "sam": {\n    "description": "What the Serviceable Available Market represents for this business given its model, geography, and capabilities (1-2 sentences)",\n    "potentialCustomers": "Estimated number of customers the business can actually serve",\n    "acv": "Same ACV as TAM unless justified differently",\n    "marketValue": "SAM market value in USD",\n    "rationale": "2-3 sentences explaining which segments of the TAM are excluded and why\"\n  },\n  "som": {\n    "description": "What the Serviceable Obtainable Market represents — the realistic short-term capture (1-2 sentences)",\n    "potentialCustomers": "Estimated number of customers realistically obtainable in year 1",\n    "acv": "Same ACV",\n    "marketValue": "SOM market value in USD",\n    "rationale": "2-3 sentences explaining competition, traction, and capture assumptions\"\n  },\n  "personas": [\n    {\n      "name": "Persona name (e.g. 'Sarah the CEO')",\n      "role": "Job title / role",\n      "description": "1-2 sentence summary of who this persona is",\n      "motivations": ["3-4 key motivations"],\n      "painPoints": ["3-4 specific pain points"],\n      "kpis": ["3-4 KPIs they are responsible for"],\n      "responsibilities": ["3-4 key responsibilities"],\n      "reportingTo": "Who they report to",\n      "buyingRole": "Their role in the buying process (e.g. decision-maker, influencer, champion)"\n    },\n    {\n      "name": "Second persona name",\n      "role": "...",\n      "description": "...",\n      "motivations": ["..."],\n      "painPoints": ["..."],\n      "kpis": ["..."],\n      "responsibilities": ["..."],\n      "reportingTo": "...",\n      "buyingRole": "..."\n    }\n  ]\n}\n\nGenerate exactly 2 distinct buyer personas. Each persona must be specific to the ICP and business context. Use concrete numbers for market sizing based on the strategy's industry, geography, and business model.\n\nMarketing strategy:\n${strategy}`
      : body.mode === "topics"
      ? `You are Elsa, an expert B2B content strategist. Create exactly 3 distinct educational content topic ideas for the business described in the strategy below. The topics must be specific, practical, credible, and suitable for a ${body.postType} post. Use all relevant business context, ideal customer profile, needs, problems, channels, tactics, and goals from the strategy. Do not invent a different business. Return ONLY a JSON array of 3 strings, with no markdown or extra text.\n\nStrategy:\n${strategy}`
      : body.mode === "drafts"
        ? `You are Elsa, an expert B2B content writer. Create exactly 3 different educational ${body.postType} post drafts for the selected topic and the complete business strategy below. Each draft must be at least 2,000 characters long, useful, specific, and ready to publish. Each must include a strong opening hook, a clear structure, concrete advice, and a concise call to action. The three drafts must use different angles and wording. Return ONLY a JSON array with exactly 3 objects, each using these fields: {"title":"short title","body":"at least 2000 characters of complete post text","callToAction":"one concise CTA"}. Do not use markdown code fences or extra text.\n\nSelected topic: ${body.selectedTopic}\n\nStrategy:\n${strategy}`
        : `You are Elsa, an expert B2B content editor. Generate exactly 3 short, strong opening hooks for the selected draft below. Hooks must be different, specific to the business and topic, and suitable for the first two lines of a ${body.postType} post. Return ONLY a JSON array of 3 strings, with no markdown or extra text.\n\nSelected topic: ${body.selectedTopic}\n\nSelected draft:\n${body.selectedDraft}\n\nStrategy:\n${strategy}`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("DEEPSEEK_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: body.mode === "topics" ? 1200 : body.mode === "drafts" ? 10000 : body.mode === "icp_insights" ? 3000 : body.mode === "smm_strategy" ? 4000 : 1200,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("DeepSeek returned an empty response");

    return new Response(JSON.stringify(extractJson(content)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Content generation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
