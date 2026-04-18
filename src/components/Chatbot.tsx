import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useSettings } from "./SettingsContext";
import { callGemini, ChatMsg } from "@/lib/gemini";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STARTERS = [
  "What's the biggest myth about recycling?",
  "How can I reduce my carbon footprint this week?",
  "Explain biodiversity loss simply.",
];

export function Chatbot() {
  const { settings, setLastModelUsed } = useSettings();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setLoading(true);
    try {
      const { text, modelUsed } = await callGemini({ mode: "chat", messages: next, settings });
      setLastModelUsed(modelUsed);
      setMessages([...next, { role: "assistant", content: text }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
      setMessages(messages); // rollback
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="chat" className="py-24">
      <div className="container max-w-4xl">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 text-accent text-sm font-semibold uppercase tracking-widest">
            <MessageCircle className="w-4 h-4" /> EcoSage Chatbot
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold">
            Ask anything about <span className="text-gradient-leaf">our planet</span>.
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Domain-locked to environment &amp; sustainability. Conversation memory keeps context turn-to-turn.
          </p>
        </div>

        <Card className="overflow-hidden shadow-leaf border-border/60">
          <div
            ref={scrollRef}
            className="h-[480px] overflow-y-auto p-6 space-y-4 bg-gradient-earth"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-leaf grid place-items-center shadow-glow animate-leaf-sway">
                  <MessageCircle className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-display text-xl font-semibold">Hi, I'm EcoSage 🌱</p>
                  <p className="text-sm text-muted-foreground mt-1">Pick a starter or ask your own question.</p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-md">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-sm p-3 rounded-xl bg-background hover:bg-card border border-border/60 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-soft",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-background border border-border/60 rounded-bl-md"
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:font-display">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-background border border-border/60 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground shadow-soft">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  EcoSage is thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 p-4 bg-card flex gap-2">
            <Input
              placeholder="Ask about climate, recycling, energy…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={loading}
              className="flex-1"
            />
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMessages([])}
                disabled={loading}
                aria-label="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button onClick={() => send()} disabled={loading || !input.trim()} className="bg-gradient-leaf">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
