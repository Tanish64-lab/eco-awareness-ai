import { useState } from "react";
import {
  Megaphone, Loader2, Sparkles, Hash, Image as ImageIcon,
  Quote, Target, Copy, Check, Scale, Palette, HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useSettings } from "./SettingsContext";
import { callGemini } from "@/lib/gemini";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Plastic pollution in oceans",
  "Air quality in cities",
  "Deforestation",
  "Saving water at home",
  "E-waste recycling",
];

type Tone = "Formal" | "Creative" | "Emotional";

const TONES: { id: Tone; label: string; desc: string; icon: typeof Scale }[] = [
  { id: "Formal",    label: "Formal",    desc: "Policy-grade, data-driven", icon: Scale },
  { id: "Creative",  label: "Creative",  desc: "Playful, witty, bold",      icon: Palette },
  { id: "Emotional", label: "Emotional", desc: "Heartfelt, human, urgent",  icon: HeartPulse },
];

interface CampaignData {
  title: string;
  tagline: string;
  slogans: string[];
  social: { post: string; hashtags: string[] };
  poster: { headline: string; visual: string };
  actions: { title: string; detail: string }[];
}

function tryParseJSON(raw: string): CampaignData | null {
  if (!raw) return null;
  // Strip markdown fences if model added them despite instructions
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned) as CampaignData; } catch { /* fall through */ }
  // Last resort: extract first {...} block
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as CampaignData; } catch { /* ignore */ } }
  return null;
}

export function CampaignGenerator() {
  const { settings } = useSettings();
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("Creative");
  const [data, setData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async (t?: string) => {
    const prompt = (t ?? topic).trim();
    if (!prompt) return;
    setLoading(true);
    setData(null);
    try {
      const text = await callGemini({
        mode: "campaign",
        prompt: `TONE: ${tone}\nTopic: ${prompt}`,
        settings,
      });
      const parsed = tryParseJSON(text);
      if (!parsed) throw new Error("Could not parse campaign. Try again.");
      setData(parsed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section id="campaign" className="py-24 bg-gradient-earth">
      <div className="container max-w-6xl">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 text-accent text-sm font-semibold uppercase tracking-widest">
            <Megaphone className="w-4 h-4" /> Campaign Generator
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold">
            Turn an issue into a <span className="text-gradient-leaf">movement</span>.
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Pick a tone, drop your topic, and watch a complete awareness kit unfold —
            tagline, slogans, social copy, poster concept, and actions.
          </p>
        </div>

        <Card className="p-6 md:p-8 shadow-leaf border-border/60">
          {/* Tone selector */}
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Choose a tone
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {TONES.map(({ id, label, desc, icon: Icon }) => {
                const active = tone === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTone(id)}
                    disabled={loading}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border p-3 md:p-4 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary bg-gradient-leaf text-primary-foreground shadow-glow"
                        : "border-border bg-background hover:border-primary/40 hover:bg-muted",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", active ? "" : "text-primary")} />
                      <span className="font-semibold text-sm md:text-base">{label}</span>
                    </div>
                    <div className={cn("text-xs mt-1", active ? "text-primary-foreground/85" : "text-muted-foreground")}>
                      {desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic input */}
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

          {loading && !data && (
            <div className="mt-8 p-6 rounded-xl bg-background border border-border/60 flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Crafting a {tone.toLowerCase()} campaign…
            </div>
          )}

          {data && (
            <div className="mt-8 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {/* Hero title card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-leaf text-primary-foreground p-7 md:p-9 shadow-leaf">
                <div className="absolute inset-0 bg-gradient-glow opacity-60 pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-90">
                    <span className="px-2 py-0.5 rounded-full bg-primary-foreground/15 backdrop-blur">
                      {tone}
                    </span>
                    <span>Campaign</span>
                  </div>
                  <h3 className="font-display text-3xl md:text-5xl font-semibold mt-3 leading-tight">
                    {data.title}
                  </h3>
                  <p className="mt-3 text-lg md:text-xl opacity-95 italic">
                    “{data.tagline}”
                  </p>
                </div>
              </div>

              {/* Two-column grid */}
              <div className="grid md:grid-cols-2 gap-5">
                {/* Slogans */}
                <Card className="p-5 border-border/60">
                  <SectionHead icon={Quote} label="Slogans" />
                  <ul className="space-y-2.5 mt-3">
                    {data.slogans?.map((s, i) => (
                      <li
                        key={i}
                        className="group flex items-start gap-3 p-3 rounded-lg bg-muted/60 hover:bg-muted transition-colors"
                      >
                        <span className="font-display text-2xl text-primary leading-none mt-0.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1 text-foreground/90 text-sm md:text-base">{s}</span>
                        <CopyBtn
                          onClick={() => copy(`slogan-${i}`, s)}
                          copied={copied === `slogan-${i}`}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Poster */}
                <Card className="p-5 border-border/60 bg-gradient-to-br from-accent/5 to-primary/5">
                  <SectionHead icon={ImageIcon} label="Poster Concept" />
                  <div className="mt-3 rounded-lg border border-dashed border-accent/40 p-5 bg-background/60">
                    <div className="text-xs uppercase tracking-widest text-accent font-semibold">
                      Headline
                    </div>
                    <div className="font-display text-xl md:text-2xl font-semibold mt-1 text-foreground">
                      {data.poster?.headline}
                    </div>
                    <div className="mt-4 text-xs uppercase tracking-widest text-accent font-semibold">
                      Visual
                    </div>
                    <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
                      {data.poster?.visual}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Social post — full width */}
              <Card className="p-5 border-border/60">
                <div className="flex items-center justify-between">
                  <SectionHead icon={Hash} label="Social Media Post" />
                  <CopyBtn
                    onClick={() =>
                      copy(
                        "social",
                        `${data.social?.post}\n\n${(data.social?.hashtags ?? []).join(" ")}`,
                      )
                    }
                    copied={copied === "social"}
                    label="Copy post"
                  />
                </div>
                <p className="mt-3 text-foreground/90 leading-relaxed whitespace-pre-line">
                  {data.social?.post}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {data.social?.hashtags?.map((h) => (
                    <span
                      key={h}
                      className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium"
                    >
                      {h.startsWith("#") ? h : `#${h}`}
                    </span>
                  ))}
                </div>
              </Card>

              {/* Actions */}
              <Card className="p-5 border-border/60">
                <SectionHead icon={Target} label="Take Action Today" />
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  {data.actions?.map((a, i) => (
                    <div
                      key={i}
                      className="relative p-4 rounded-xl bg-gradient-to-br from-muted to-background border border-border/60 hover:shadow-soft transition-all"
                    >
                      <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-gradient-leaf text-primary-foreground text-xs font-bold flex items-center justify-center shadow-soft">
                        {i + 1}
                      </div>
                      <div className="font-semibold text-foreground mt-1">{a.title}</div>
                      <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {a.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function SectionHead({ icon: Icon, label }: { icon: typeof Quote; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      <Icon className="w-4 h-4 text-primary" />
      {label}
    </div>
  );
}

function CopyBtn({
  onClick, copied, label,
}: { onClick: () => void; copied: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
      {label ?? (copied ? "Copied" : "Copy")}
    </button>
  );
}
