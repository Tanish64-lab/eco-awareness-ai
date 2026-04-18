import { supabase } from "@/integrations/supabase/client";

export type GeminiMode = "campaign" | "chat" | "quiz" | "tip";

export interface GeminiSettings {
  temperature: number;
  topP: number;
  model: string;
  /** Optional user-supplied Gemini API key — overrides the server key when present. */
  userApiKey?: string;
}

export const DEFAULT_SETTINGS: GeminiSettings = {
  temperature: 0.7,
  topP: 0.9,
  model: "gemini-2.5-flash",
  userApiKey: "",
};

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface GeminiResult {
  text: string;
  /** The model that actually answered (may differ from requested due to fallback). */
  modelUsed: string;
}

export async function callGemini(opts: {
  mode: GeminiMode;
  messages?: ChatMsg[];
  prompt?: string;
  settings: GeminiSettings;
}): Promise<GeminiResult> {
  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: {
      mode: opts.mode,
      messages: opts.messages,
      prompt: opts.prompt,
      temperature: opts.settings.temperature,
      topP: opts.settings.topP,
      model: opts.settings.model,
      userApiKey: opts.settings.userApiKey?.trim() || undefined,
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return { text: data?.text ?? "", modelUsed: data?.modelUsed ?? opts.settings.model };
}
