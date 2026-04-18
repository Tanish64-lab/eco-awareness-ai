import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Megaphone, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useSettings } from "./SettingsContext";
import { callGemini } from "@/lib/gemini";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Plastic pollution in oceans",
  "Air quality in cities",
  "Deforestation",
  "Saving water at home",
  "E-waste recycling",
];

export function CampaignGenerator() {
  const { settings } = useSettings();
  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async (t?: string) => {
    const prompt = (t ?? topic).trim();
    if (!prompt) return;
    setLoading(true);
    setOutput("");
    try {
      const text = await callGemini({
        mode: "campaign",
        prompt: `Topic: ${prompt}`,
        settings,
      });
      setOutput(text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="campaign" className="py-24 bg-gradient-earth">
      <div className="container max-w-5xl">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 text-accent text-sm font-semibold uppercase tracking-widest">
            <Megaphone className="w-4 h-4" /> Campaign Generator
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold">
            Turn an issue into a <span className="text-gradient-leaf">movement</span>.
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Enter any environmental topic. Gemini will craft a title, slogans, social copy,
            poster concept, and call-to-actions in seconds.
          </p>
        </div>

        <Card className="p-6 md:p-8 shadow-leaf border-border/60">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="e.g. Reducing single-use plastics"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              className="flex-1 h-12 text-base"
            />
            <Button
              size="lg"
              onClick={() => generate()}
              disabled={loading || !topic.trim()}
              className="bg-gradient-leaf hover:opacity-95 shadow-glow font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-xs text-muted-foreground self-center mr-1">Try:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setTopic(s); generate(s); }}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          {output && (
            <div className="mt-8 p-6 rounded-xl bg-background border border-border/60 prose prose-sm md:prose-base max-w-none prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground prose-p:text-foreground/90">
              <ReactMarkdown>{output}</ReactMarkdown>
            </div>
          )}

          {loading && !output && (
            <div className="mt-8 p-6 rounded-xl bg-background border border-border/60 flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Crafting your campaign…
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
