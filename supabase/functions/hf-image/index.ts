// Hugging Face image generation edge function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, model } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!HF_KEY) {
      return new Response(JSON.stringify({ error: "HUGGINGFACE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidates = model
      ? [model]
      : [
          "black-forest-labs/FLUX.1-schnell",
          "stabilityai/stable-diffusion-xl-base-1.0",
          "stabilityai/stable-diffusion-2-1",
        ];

    let r: Response | null = null;
    let lastErr = "";
    let usedModel = "";

    for (const modelId of candidates) {
      const url = `https://router.huggingface.co/hf-inference/models/${modelId}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          "Content-Type": "application/json",
          Accept: "image/png",
        },
        body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
      });

      if (resp.ok) {
        r = resp;
        usedModel = modelId;
        break;
      }
      lastErr = `${modelId} -> ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
      console.error("HF model failed:", lastErr);
    }

    if (!r) {
      return new Response(JSON.stringify({ error: `All HF models failed. Last: ${lastErr}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("HF success with model:", usedModel);
    const buf = await r.arrayBuffer();
    // base64 encode
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const dataUrl = `data:image/png;base64,${base64}`;

    return new Response(JSON.stringify({ image: dataUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
