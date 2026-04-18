import { ArrowDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-leaves.jpg";

export function Hero() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section id="hero" className="relative min-h-[92vh] flex items-center overflow-hidden">
      <img
        src={heroImg}
        alt="Dewy green leaves in morning forest light"
        className="absolute inset-0 w-full h-full object-cover"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 bg-gradient-glow opacity-60 animate-pulse-glow" />

      <div className="container relative z-10 py-24">
        <div className="max-w-3xl space-y-8 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur-sm px-4 py-1.5 text-sm text-primary-foreground">
            <Sparkles className="w-4 h-4" />
            Powered by Google Gemini
          </div>

          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-semibold leading-[1.05] text-primary-foreground">
            Spark a <em className="not-italic text-gradient-leaf bg-clip-text">greener</em> tomorrow,
            one campaign at a time.
          </h1>

          <p className="text-lg md:text-xl text-primary-foreground/85 max-w-2xl leading-relaxed">
            Generate full environmental awareness campaigns, chat with EcoSage about
            climate &amp; sustainability, and test what you know — all in one place.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              variant="secondary"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold shadow-leaf"
              onClick={() => scrollTo("campaign")}
            >
              Generate a campaign
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => scrollTo("chat")}
            >
              Talk to EcoSage
            </Button>
          </div>
        </div>

        <button
          onClick={() => scrollTo("campaign")}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
          aria-label="Scroll down"
        >
          <ArrowDown className="w-6 h-6 animate-bounce" />
        </button>
      </div>
    </section>
  );
}
