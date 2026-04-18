import { useState } from "react";
import { Brain, Loader2, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSettings } from "./SettingsContext";
import { callGemini } from "@/lib/gemini";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Q {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function Quiz() {
  const { settings } = useSettings();
  const [q, setQ] = useState<Q | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const fetchQuestion = async () => {
    setLoading(true);
    setPicked(null);
    setQ(null);
    try {
      const text = await callGemini({
        mode: "quiz",
        prompt: "Generate one question.",
        settings: { ...settings, temperature: 0.9 }, // creative pick
      });
      // Strip code fences if any
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setQ(parsed);
    } catch (e) {
      toast.error("Couldn't load question. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const choose = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    setScore((s) => ({ right: s.right + (i === q.correctIndex ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <section id="quiz" className="py-24 bg-gradient-earth">
      <div className="container max-w-3xl">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 text-accent text-sm font-semibold uppercase tracking-widest">
            <Brain className="w-4 h-4" /> Eco Quiz
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold">
            Test your <span className="text-gradient-leaf">eco-IQ</span>.
          </h2>
          <p className="text-muted-foreground">
            AI-generated questions on climate, recycling, biodiversity &amp; more.
          </p>
        </div>

        <Card className="p-6 md:p-8 shadow-leaf border-border/60">
          {!q && !loading && (
            <div className="text-center py-12 space-y-4">
              <p className="text-muted-foreground">Ready to begin?</p>
              <Button size="lg" onClick={fetchQuestion} className="bg-gradient-leaf shadow-glow">
                Start Quiz
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating question…
            </div>
          )}

          {q && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Score: <span className="font-semibold text-foreground">{score.right}/{score.total}</span></span>
                <Button variant="ghost" size="sm" onClick={fetchQuestion} disabled={loading}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> New
                </Button>
              </div>

              <h3 className="font-display text-2xl font-semibold leading-snug">{q.question}</h3>

              <div className="grid gap-3">
                {q.options.map((opt, i) => {
                  const isCorrect = i === q.correctIndex;
                  const isPicked = i === picked;
                  const showResult = picked !== null;
                  return (
                    <button
                      key={i}
                      onClick={() => choose(i)}
                      disabled={picked !== null}
                      className={cn(
                        "text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3",
                        !showResult && "border-border hover:border-primary hover:bg-muted",
                        showResult && isCorrect && "border-primary bg-primary/10",
                        showResult && isPicked && !isCorrect && "border-destructive bg-destructive/10",
                        showResult && !isPicked && !isCorrect && "border-border opacity-50"
                      )}
                    >
                      <span className="text-sm md:text-base">{opt}</span>
                      {showResult && isCorrect && <Check className="w-5 h-5 text-primary shrink-0" />}
                      {showResult && isPicked && !isCorrect && <X className="w-5 h-5 text-destructive shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {picked !== null && (
                <div className="p-4 rounded-xl bg-muted text-sm leading-relaxed animate-fade-up">
                  <p className="font-semibold mb-1">
                    {picked === q.correctIndex ? "✅ Correct!" : "❌ Not quite."}
                  </p>
                  <p className="text-muted-foreground">{q.explanation}</p>
                  <Button onClick={fetchQuestion} className="mt-4 bg-gradient-leaf" size="sm">
                    Next question
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
