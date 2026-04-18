import { useState } from "react";
import { Settings as SettingsIcon, Leaf, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function Header() {
  const [open, setOpen] = useState(false);
  const { settings, setSettings } = useSettings();
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
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="font-display text-2xl">Model Settings</SheetTitle>
              <SheetDescription>
                Tune how Gemini responds. Lower = factual; higher = creative.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-8 py-8">
              <div className="space-y-3">
                <Label>Model</Label>
                <Select
                  value={settings.model}
                  onValueChange={(v) => setSettings({ ...settings, model: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                  </SelectContent>
                </Select>
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
