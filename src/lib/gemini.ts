import { supabase } from "@/integrations/supabase/client";

export type GeminiMode = "campaign" | "chat" | "quiz" | "tip";

export interface GeminiSettings {
  temperature: number;
  topP: number;
  model: string;
}

export const DEFAULT_SETTINGS: GeminiSettings = {
  temperature: 0.7,
  topP: 0.9,
  model: "gemini-2.0-flash",
};

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export async function callGemini(opts: {
  mode: GeminiMode;
  messages?: ChatMsg[];
  prompt?: string;
  settings: GeminiSettings;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("gemini-ai", {
    body: {
      mode: opts.mode,
      messages: opts.messages,
      prompt: opts.prompt,
      temperature: opts.settings.temperature,
      topP: opts.settings.topP,
      model: opts.settings.model,
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data?.text ?? "";
}
