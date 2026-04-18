import { useEffect, useState } from "react";
import { Sprout, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSettings } from "./SettingsContext";
import { callGemini } from "@/lib/gemini";

export function DailyTip() {
  const { settings, setLastModelUsed } = useSettings();
  const [tip, setTip] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { text, modelUsed } = await callGemini({
        mode: "tip",
        prompt: "One eco-tip.",
        settings: { ...settings, temperature: 0.95 },
      });
      setLastModelUsed(modelUsed);
      setTip(text.trim());
    } catch {
      setTip("Skip one short car trip this week — walk or cycle instead. Even small swaps reduce CO₂.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <section id="tip" className="py-24">
      <div className="container max-w-3xl">
        <Card className="relative overflow-hidden p-8 md:p-12 bg-gradient-leaf text-primary-foreground shadow-leaf">
          <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-primary-foreground/10 animate-pulse-glow" />
          <div className="absolute -left-8 -bottom-8 w-40 h-40 rounded-full bg-primary-foreground/5" />

          <div className="relative space-y-6">
            <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest opacity-90">
              <Sprout className="w-4 h-4 animate-leaf-sway" /> Today's Eco Tip
            </div>

            <p className="font-display text-2xl md:text-3xl leading-snug min-h-[6rem]">
              {loading ? (
                <span className="inline-flex items-center gap-2 opacity-70 text-lg">
                  <Loader2 className="w-5 h-5 animate-spin" /> Growing a fresh tip…
                </span>
              ) : (
                <>"{tip}"</>
              )}
            </p>

            <Button
              variant="secondary"
              onClick={load}
              disabled={loading}
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Another tip
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
