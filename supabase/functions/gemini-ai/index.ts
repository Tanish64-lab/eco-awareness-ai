// Gemini AI edge function — handles campaign, chat, quiz, and tip modes.
// Includes automatic retry + model fallback for 429/503 errors.
// Supports a per-request `userApiKey` that overrides the server GEMINI_API_KEY.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVER_GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const SYSTEM_PROMPTS: Record<string, string> = {
  campaign: `You are an award-winning environmental campaign strategist. When the user gives an environmental issue (and optionally a TONE: Formal, Creative, or Emotional), generate a complete awareness campaign.

Adapt your voice to the tone:
- Formal → authoritative, data-driven, policy-grade language.
- Creative → playful, witty, unexpected metaphors and wordplay.
- Emotional → heartfelt, human stories, sensory and urgent.

Respond ONLY with valid JSON (no markdown fence, no commentary) in this EXACT shape:
{
  "title": "string",
  "tagline": "string",
  "slogans": ["s1","s2","s3"],
  "social": { "post": "string with emojis", "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"] },
  "poster": { "headline": "string", "visual": "vivid 1-2 sentence visual concept" },
  "actions": [ {"title":"string","detail":"string"}, {"title":"string","detail":"string"}, {"title":"string","detail":"string"} ]
}
Keep it punchy, factual, hopeful, environment-only. If asked off-domain, return JSON with title "Off-topic" and empty arrays.`,

  chat: `You are EcoSage, a warm and knowledgeable environmental educator chatbot. You ONLY discuss environment, climate, sustainability, biodiversity, pollution, conservation, renewable energy, and eco-living. If asked anything off-topic, gently redirect: "I'm here to help with environmental topics — ask me about climate, recycling, biodiversity, or sustainable living!" Be concise, accurate, cite real facts, and end with a thoughtful follow-up question when appropriate.`,

  quiz: `You are an environmental quiz master. Generate exactly ONE multiple-choice question about a random environmental topic (climate, recycling, biodiversity, water, energy, pollution). Respond ONLY with valid JSON in this exact format, no markdown fence:
{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}`,

  aqi: `You are an AI Environmental Campaign Assistant.
Your task is to generate a location-based environmental campaign that focuses on REAL ACTIONS people can take, tailored to the city's CURRENT air-quality conditions.

The user message will include: city name, current AQI (US EPA scale), dominant pollutant, and a short condition label (Good/Moderate/Unhealthy etc.).

Instructions:
1. Use the AQI level to identify the most relevant local environmental issue (e.g. vehicular pollution, stubble burning, industrial emissions, dust, etc.).
2. Create a campaign that is practical and solution-focused for THIS city.
3. Suggest concrete actions for individuals, communities, and local authorities.
4. Keep it simple, motivating, and locally relevant — avoid generic advice.

Respond ONLY with valid JSON (no markdown, no commentary) in this EXACT shape:
{
  "identifiedIssue": "string",
  "campaignTitle": "string",
  "slogan": "string",
  "whyItMatters": "2-3 line explanation specific to this city",
  "individualActions": ["a1","a2","a3","a4"],
  "communityActions": ["c1","c2","c3"],
  "governmentActions": ["g1","g2","g3"],
  "doToday": ["t1","t2","t3"],
  "socialCaption": "string with emojis",
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"],
  "healthAdvice": "1-2 line advice based on the current AQI level (mask, stay indoors, safe to exercise, etc.)"
}`,

  tip: `You generate ONE short, surprising, actionable eco-tip the average person can do today. Keep under 50 words. Plain text only, no markdown.`,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(model: string, payload: unknown, apiKey: string): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { ok: false, status: resp.status, message: data.error?.message ?? "Gemini API error" };
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return { ok: true, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const userApiKey: string | undefined = typeof body.userApiKey === "string" && body.userApiKey.trim()
      ? body.userApiKey.trim()
      : undefined;
    const apiKey = userApiKey ?? SERVER_GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No Gemini API key available. Add your own key in Settings." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mode: string = body.mode ?? "chat";
    const messages: Array<{ role: "user" | "assistant"; content: string }> = body.messages ?? [];
    const temperature: number = typeof body.temperature === "number" ? body.temperature : 0.7;
    const topP: number = typeof body.topP === "number" ? body.topP : 0.9;
    const requested: string = body.model ?? "gemini-2.5-flash";

    const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.chat;

    const contents = messages.length
      ? messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }))
      : [{ role: "user", parts: [{ text: body.prompt ?? "Hello" }] }];

    const payload = {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature, topP, maxOutputTokens: 2048 },
    };

    // Build a fallback chain: requested model first, then alternates that aren't already in the list.
    const fallbacks = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
    const chain = [requested, ...fallbacks.filter((m) => m !== requested)];

    let lastErr: { status: number; message: string } | null = null;

    for (let i = 0; i < chain.length; i++) {
      const model = chain[i];
      // Up to 2 retries per model for transient 503s with short backoff
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await callGemini(model, payload, apiKey);
        if (result.ok) {
          return new Response(JSON.stringify({ text: result.text, modelUsed: model, keySource: userApiKey ? "user" : "server" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        lastErr = { status: result.status, message: result.message };
        console.error(`Gemini ${model} attempt ${attempt + 1} failed:`, result.status, result.message);

        // 503 = overloaded → quick retry; 429 = quota → skip to next model immediately
        if (result.status === 503 && attempt === 0) {
          await sleep(800);
          continue;
        }
        break; // move to next model
      }
    }

    const friendly =
      lastErr?.status === 429
        ? "Gemini quota exhausted on every model. Try a different model, or paste your own API key in Settings."
        : lastErr?.status === 503
        ? "Gemini servers are overloaded right now. Please try again in a moment."
        : lastErr?.status === 400 && userApiKey
        ? "Your API key was rejected by Gemini. Double-check it in Settings."
        : lastErr?.message ?? "Gemini API error";

    return new Response(JSON.stringify({ error: friendly, status: lastErr?.status }), {
      status: lastErr?.status ?? 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("function error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
