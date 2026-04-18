import { useState } from "react";
import { Settings as SettingsIcon, Leaf, Sun, Moon, KeyRound, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/use-theme";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSettings } from "./SettingsContext";

const MODEL_LABELS: Record<string, string> = {
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash-Lite",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
};

export function Header() {
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const { settings, setSettings, lastModelUsed } = useSettings();
  const { theme, toggle } = useTheme();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/50">
      <div className="container flex h-16 items-center justify-between">
        <button
          onClick={() => scrollTo("hero")}
          className="flex items-center gap-2 group"
          aria-label="EcoSpark home"
        >
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-leaf shadow-glow">
            <Leaf className="w-5 h-5 text-primary-foreground" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Eco<span className="text-gradient-leaf">Spark</span>
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <button onClick={() => scrollTo("campaign")} className="hover:text-foreground transition-colors">Campaign</button>
          <button onClick={() => scrollTo("chat")} className="hover:text-foreground transition-colors">Chatbot</button>
          <button onClick={() => scrollTo("quiz")} className="hover:text-foreground transition-colors">Quiz</button>
          <button onClick={() => scrollTo("tip")} className="hover:text-foreground transition-colors">Daily Tip</button>
        </nav>

        <div className="flex items-center gap-1">
          {/* Active model badge */}
          {lastModelUsed && (
            <div
              className="hidden sm:flex items-center gap-1.5 mr-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
              title={`Last response from ${lastModelUsed}${settings.userApiKey ? " · using your API key" : ""}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {MODEL_LABELS[lastModelUsed] ?? lastModelUsed}
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="relative"
          >
            <Sun className="w-5 h-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute w-5 h-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Model settings">
                <SettingsIcon className="w-5 h-5" />
              </Button>
            </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-display text-2xl">Model Settings</SheetTitle>
              <SheetDescription>
                Tune how Gemini responds. Lower = factual; higher = creative.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-8 py-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Model</Label>
                  {lastModelUsed && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Last used: {MODEL_LABELS[lastModelUsed] ?? lastModelUsed}
                    </span>
                  )}
                </div>
                <Select
                  value={settings.model}
                  onValueChange={(v) => setSettings({ ...settings, model: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash — balanced</SelectItem>
                    <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite — fastest, cheapest</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If your selected model is rate-limited, the app automatically falls back to the other Flash models.
                </p>
              </div>

              {/* User API key */}
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/40 p-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <Label className="font-semibold">Use your own Gemini API key</Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  Optional. If the shared key hits its quota, paste your own key to keep going. Stored only in your browser.
                </p>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder="AIza…"
                    value={settings.userApiKey ?? ""}
                    onChange={(e) => setSettings({ ...settings, userApiKey: e.target.value })}
                    className="pr-10 font-mono text-xs"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    aria-label={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Get a free key <ExternalLink className="w-3 h-3" />
                  </a>
                  {settings.userApiKey && (
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, userApiKey: "" })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Clear key
                    </button>
                  )}
                </div>
                <div className="text-[11px] font-medium">
                  {settings.userApiKey ? (
                    <span className="text-primary">● Using your personal API key</span>
                  ) : (
                    <span className="text-muted-foreground">○ Using the shared app key</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Temperature</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {settings.temperature.toFixed(2)}
                  </span>
                </div>
                <Slider
                  min={0} max={1} step={0.05}
                  value={[settings.temperature]}
                  onValueChange={([v]) => setSettings({ ...settings, temperature: v })}
                />
                <p className="text-xs text-muted-foreground">
                  Controls randomness. 0.2 = deterministic facts, 0.9 = creative slogans.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Top-p (Nucleus)</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {settings.topP.toFixed(2)}
                  </span>
                </div>
                <Slider
                  min={0.1} max={1} step={0.05}
                  value={[settings.topP]}
                  onValueChange={([v]) => setSettings({ ...settings, topP: v })}
                />
                <p className="text-xs text-muted-foreground">
                  Probability mass cap. Lower = safer; higher = broader vocabulary.
                </p>
              </div>

              <div className="rounded-xl bg-muted p-4 text-sm space-y-2">
                <p className="font-semibold">Suggested presets</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSettings({ ...settings, temperature: 0.2, topP: 0.8 })}>Factual</Button>
                  <Button variant="outline" size="sm" onClick={() => setSettings({ ...settings, temperature: 0.9, topP: 0.95 })}>Creative</Button>
                </div>
              </div>
            </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
