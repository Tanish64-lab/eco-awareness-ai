// Gemini AI edge function — handles campaign, chat, and quiz modes
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
    const model: string = body.model ?? "gemini-2.0-flash";

    const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.chat;

    // Build Gemini contents from message history
    const contents = messages.length
      ? messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }))
      : [{ role: "user", parts: [{ text: body.prompt ?? "Hello" }] }];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature,
          topP,
          maxOutputTokens: 2048,
        },
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Gemini error:", data);
      return new Response(JSON.stringify({ error: data.error?.message ?? "Gemini API error" }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("function error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
