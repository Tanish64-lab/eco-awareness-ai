import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { DEFAULT_SETTINGS, GeminiSettings } from "@/lib/gemini";

interface Ctx {
  settings: GeminiSettings;
  setSettings: (s: GeminiSettings) => void;
  /** Last model that actually answered a request (set by feature components). */
  lastModelUsed: string | null;
  setLastModelUsed: (m: string | null) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "ecospark.settings.v1";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GeminiSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_SETTINGS;
  });
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings, lastModelUsed, setLastModelUsed }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
