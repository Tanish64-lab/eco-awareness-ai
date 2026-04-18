// Gemini AI edge function — handles campaign, chat, quiz, and tip modes.
// Includes automatic retry + model fallback for 429/503 errors.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const SYSTEM_PROMPTS: Record<string, string> = {
  campaign: `You are an award-winning environmental campaign strategist. When the user gives an environmental issue, generate a complete awareness campaign in markdown with these sections:
## Campaign Title
## Tagline
## 3 Slogans
## Social Media Post (Instagram/Twitter ready, with hashtags)
## Poster Concept (visual + headline)
## 3 Call-to-Action steps the public can take today
Keep it punchy, factual, hopeful, and rooted in the chosen domain (environment/sustainability). Refuse anything off-domain politely.`,

  chat: `You are EcoSage, a warm and knowledgeable environmental educator chatbot. You ONLY discuss environment, climate, sustainability, biodiversity, pollution, conservation, renewable energy, and eco-living. If asked anything off-topic, gently redirect: "I'm here to help with environmental topics — ask me about climate, recycling, biodiversity, or sustainable living!" Be concise, accurate, cite real facts, and end with a thoughtful follow-up question when appropriate.`,

  quiz: `You are an environmental quiz master. Generate exactly ONE multiple-choice question about a random environmental topic (climate, recycling, biodiversity, water, energy, pollution). Respond ONLY with valid JSON in this exact format, no markdown fence:
{"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}`,

  tip: `You generate ONE short, surprising, actionable eco-tip the average person can do today. Keep under 50 words. Plain text only, no markdown.`,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(model: string, payload: unknown): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
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
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const mode: string = body.mode ?? "chat";
    const messages: Array<{ role: "user" | "assistant"; content: string }> = body.messages ?? [];
    const temperature: number = typeof body.temperature === "number" ? body.temperature : 0.7;
    const topP: number = typeof body.topP === "number" ? body.topP : 0.9;
    const requested: string = body.model ?? "gemini-2.0-flash";

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
    const fallbacks = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];
    const chain = [requested, ...fallbacks.filter((m) => m !== requested)];

    let lastErr: { status: number; message: string } | null = null;

    for (let i = 0; i < chain.length; i++) {
      const model = chain[i];
      // Up to 2 retries per model for transient 503s with short backoff
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await callGemini(model, payload);
        if (result.ok) {
          return new Response(JSON.stringify({ text: result.text, modelUsed: model }), {
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
        ? "Gemini quota exhausted on every model. Check your API key billing/limits."
        : lastErr?.status === 503
        ? "Gemini servers are overloaded right now. Please try again in a moment."
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
