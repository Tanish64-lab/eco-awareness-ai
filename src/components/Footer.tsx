import { Leaf, Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 py-10 bg-card">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-primary" />
          <span className="font-display font-semibold text-foreground">EcoSpark</span>
          <span>— AI for a greener planet.</span>
        </div>
        <p>Built with Gemini · INT428 Project</p>
      </div>
    </footer>
  );
}
