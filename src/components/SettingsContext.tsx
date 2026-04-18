import { createContext, useContext, useState, ReactNode } from "react";
import { DEFAULT_SETTINGS, GeminiSettings } from "@/lib/gemini";

interface Ctx {
  settings: GeminiSettings;
  setSettings: (s: GeminiSettings) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GeminiSettings>(DEFAULT_SETTINGS);
  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
