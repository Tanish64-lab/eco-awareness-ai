import { useState } from "react";
import {
  MapPin, Loader2, Locate, Wind, AlertTriangle, Users, Building2,
  CheckCircle2, Sparkles, RefreshCw, Image as ImageIcon, Download, HeartPulse, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSettings } from "./SettingsContext";
import { callGemini } from "@/lib/gemini";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AqiData {
  city: string;
  aqi: number;
  category: string;
  color: string;
  dominant: string;
  pm25: number;
  pm10: number;
  lat: number;
  lon: number;
}

interface ActionWithEffort { action: string; effort: "Easy" | "Medium" | "Hard" | string }

interface Campaign {
  identifiedIssue: string;
  campaignTitle: string;
  slogan: string;
  personalHealthImpact: string;
  whyItMatters: string;
  individualActions: ActionWithEffort[];
  communityActions: string[];
  governmentActions: string[];
  doToday: string[];
  impactScore: string;
  socialCaption: string;
  hashtags: string[];
  healthAdvice: string;
  puterImagePrompt: string;
}

declare global {
  interface Window {
    puter?: {
      ai: { txt2img: (prompt: string) => Promise<HTMLImageElement | string> };
    };
  }
}

function pm25ToAqi(c: number): number {
  const bp = [
    [0, 12, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 500.4, 301, 500],
  ];
  for (const [cl, ch, il, ih] of bp) {
    if (c >= cl && c <= ch) return Math.round(((ih - il) / (ch - cl)) * (c - cl) + il);
  }
  return c > 500.4 ? 500 : 0;
}

function aqiCategory(aqi: number): { category: string; color: string } {
  if (aqi <= 50) return { category: "Good", color: "bg-green-500" };
  if (aqi <= 100) return { category: "Moderate", color: "bg-yellow-500" };
  if (aqi <= 150) return { category: "Unhealthy for Sensitive Groups", color: "bg-orange-500" };
  if (aqi <= 200) return { category: "Unhealthy", color: "bg-red-500" };
  if (aqi <= 300) return { category: "Very Unhealthy", color: "bg-purple-600" };
  return { category: "Hazardous", color: "bg-rose-900" };
}

async function geocode(city: string) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  const d = await r.json();
  if (!d.results?.length) return null;
  const x = d.results[0];
  return { lat: x.latitude, lon: x.longitude, name: `${x.name}${x.admin1 ? ", " + x.admin1 : ""}, ${x.country}` };
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`);
    const d = await r.json();
    if (d.results?.length) {
      const x = d.results[0];
      return `${x.name}${x.admin1 ? ", " + x.admin1 : ""}, ${x.country}`;
    }
  } catch { /* ignore */ }
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

async function fetchAqi(lat: number, lon: number, name: string): Promise<AqiData> {
  const r = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&timezone=auto`
  );
  const d = await r.json();
  const c = d.current;
  const aqi = typeof c.us_aqi === "number" ? Math.round(c.us_aqi) : pm25ToAqi(c.pm2_5 ?? 0);
  const cat = aqiCategory(aqi);
  const pollutants: Record<string, number> = {
    "PM2.5": (c.pm2_5 ?? 0) / 35,
    "PM10": (c.pm10 ?? 0) / 150,
    "Ozone": (c.ozone ?? 0) / 100,
    "NO₂": (c.nitrogen_dioxide ?? 0) / 100,
    "SO₂": (c.sulphur_dioxide ?? 0) / 75,
    "CO": (c.carbon_monoxide ?? 0) / 9000,
  };
  const dominant = Object.entries(pollutants).sort((a, b) => b[1] - a[1])[0][0];
  return { city: name, aqi, category: cat.category, color: cat.color, dominant, pm25: c.pm2_5 ?? 0, pm10: c.pm10 ?? 0, lat, lon };
}

const effortStyle: Record<string, string> = {
  Easy: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  Medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Hard: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const impactStyle: Record<string, string> = {
  Low: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  Medium: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  High: "bg-green-500/15 text-green-700 dark:text-green-400",
};

interface CitySuggestion {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  id: number;
}

export function CampaignGenerator() {
  const { settings, setLastModelUsed } = useSettings();
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [aqi, setAqi] = useState<AqiData | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterLoading, setPosterLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const q = city.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
        const d = await r.json();
        setSuggestions(d.results ?? []);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [city]);

  const pickSuggestion = async (s: CitySuggestion) => {
    const name = `${s.name}${s.admin1 ? ", " + s.admin1 : ""}, ${s.country}`;
    setCity(s.name);
    setShowSuggestions(false);
    setSuggestions([]);
    setLoading(true);
    setCampaign(null);
    setPosterUrl(null);
    try {
      const data = await fetchAqi(s.latitude, s.longitude, name);
      setAqi(data);
      generateCampaign(data);
    } catch {
      toast.error("Couldn't fetch air quality data.");
    } finally { setLoading(false); }
  };

  const loadByCity = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setShowSuggestions(false);
    if (!city.trim()) return toast.error("Enter a city name");
    setLoading(true);
    setCampaign(null);
    setPosterUrl(null);
    try {
      const g = await geocode(city.trim());
      if (!g) { toast.error("City not found"); return; }
      const data = await fetchAqi(g.lat, g.lon, g.name);
      setAqi(data);
      generateCampaign(data);
    } catch {
      toast.error("Couldn't fetch air quality data.");
    } finally { setLoading(false); }
  };

  const loadByLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setLoading(true);
    setCampaign(null);
    setPosterUrl(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          const data = await fetchAqi(pos.coords.latitude, pos.coords.longitude, name);
          setAqi(data);
          generateCampaign(data);
        } catch { toast.error("Couldn't fetch air quality."); }
        finally { setLoading(false); }
      },
      () => { toast.error("Location permission denied"); setLoading(false); },
      { timeout: 10000 }
    );
  };

  const generateCampaign = async (data: AqiData) => {
    setGenLoading(true);
    setPosterUrl(null);
    try {
      const prompt = `City: ${data.city}
Current US AQI: ${data.aqi} (${data.category})
Dominant pollutant: ${data.dominant}
PM2.5: ${data.pm25.toFixed(1)} μg/m³, PM10: ${data.pm10.toFixed(1)} μg/m³

Generate the location-based campaign now.`;
      const { text, modelUsed } = await callGemini({
        mode: "aqi",
        prompt,
        settings: { ...settings, temperature: 0.8 },
      });
      setLastModelUsed(modelUsed);
      let cleaned = text.replace(/```json|```/g, "").trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first !== -1 && last !== -1) cleaned = cleaned.slice(first, last + 1);
      try {
        setCampaign(JSON.parse(cleaned));
      } catch (parseErr) {
        console.error("Campaign JSON parse failed. Raw text:", text);
        toast.error("Response was incomplete. Please try again.");
      }
    } catch (err) {
      console.error("Campaign generation error:", err);
      toast.error("Couldn't generate campaign. Try again.");
    } finally { setGenLoading(false); }
  };

  const generatePoster = async () => {
    if (!campaign?.puterImagePrompt) return;
    if (!window.puter?.ai?.txt2img) {
      toast.error("Puter.js not loaded yet. Please retry in a moment.");
      return;
    }
    setPosterLoading(true);
    setPosterUrl(null);
    try {
      const result = await window.puter.ai.txt2img(campaign.puterImagePrompt);
      // Puter returns either an HTMLImageElement or a string URL/data URL
      const url = typeof result === "string" ? result : (result as HTMLImageElement).src;
      setPosterUrl(url);
      toast.success("Poster generated!");
    } catch (e) {
      toast.error("Poster generation failed. Puter.js may require sign-in.");
      console.error(e);
    } finally { setPosterLoading(false); }
  };

  return (
    <section id="campaign" className="py-24 bg-gradient-earth">
      <div className="container max-w-5xl">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 text-accent text-sm font-semibold uppercase tracking-widest">
            <Wind className="w-4 h-4" /> Live AQI Campaign + AI Poster
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold">
            Your city. Your air. <span className="text-gradient-leaf">Your action.</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Enter a location or use your live position. We pull real-time air quality from Open-Meteo,
            generate a tailored awareness campaign, and create a poster image with Puter.js.
          </p>
        </div>

        <Card className="p-6 md:p-8 shadow-leaf border-border/60 space-y-6">
          <form onSubmit={loadByCity} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="e.g. Delhi, Mumbai, London…"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="pl-9"
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading} className="bg-gradient-leaf shadow-glow">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get AQI"}
            </Button>
            <Button type="button" variant="outline" onClick={loadByLocation} disabled={loading}>
              <Locate className="w-4 h-4 mr-1" /> Use my location
            </Button>
          </form>

          {aqi && (
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 animate-fade-up">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Location</div>
                  <div className="font-display text-xl font-semibold">{aqi.city}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn("w-14 h-14 rounded-xl grid place-items-center text-white font-bold text-xl shadow-md", aqi.color)}>
                    {aqi.aqi}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">US AQI</div>
                    <div className="font-semibold">{aqi.category}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Dominant</div>
                  <div className="font-semibold">{aqi.dominant}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">PM2.5</div>
                  <div className="font-semibold">{aqi.pm25.toFixed(1)} μg/m³</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">PM10</div>
                  <div className="font-semibold">{aqi.pm10.toFixed(1)} μg/m³</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Source: Open-Meteo Air Quality API · Live
              </p>
            </div>
          )}

          {genLoading && (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating awareness campaign for your area…
            </div>
          )}

          {campaign && !genLoading && (
            <div className="space-y-5 animate-fade-up">
              <div className="rounded-2xl bg-gradient-leaf p-6 text-primary-foreground shadow-glow">
                <div className="text-xs uppercase tracking-widest opacity-80">Identified Issue</div>
                <div className="font-semibold mb-3">{campaign.identifiedIssue}</div>
                <h3 className="font-display text-3xl font-bold leading-tight">{campaign.campaignTitle}</h3>
                <p className="italic mt-2 opacity-95">"{campaign.slogan}"</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border-l-4 border-rose-500 bg-rose-500/10 p-4 flex gap-3">
                  <HeartPulse className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm mb-1">Personal Health Impact</div>
                    <p className="text-sm text-muted-foreground">{campaign.personalHealthImpact}</p>
                  </div>
                </div>
                <div className="rounded-xl border-l-4 border-accent bg-accent/10 p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm mb-1">Health advice</div>
                    <p className="text-sm text-muted-foreground">{campaign.healthAdvice}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-muted p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Why it matters here</div>
                <p className="text-sm">{campaign.whyItMatters}</p>
              </div>

              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Sparkles className="w-4 h-4" /> Individual Actions
                  </div>
                  {campaign.impactScore && (
                    <span className={cn(
                      "text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1",
                      impactStyle[campaign.impactScore] ?? "bg-muted text-muted-foreground"
                    )}>
                      <Gauge className="w-3 h-3" /> Impact: {campaign.impactScore}
                    </span>
                  )}
                </div>
                <ul className="space-y-2">
                  {campaign.individualActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/60">
                      <span className="font-display text-lg text-primary leading-none mt-0.5 w-6">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-sm">{a.action}</span>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0", effortStyle[a.effort] ?? "bg-muted")}>
                        {a.effort}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Users className="w-4 h-4" /> Community Actions
                  </div>
                  <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                    {campaign.communityActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </Card>
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Building2 className="w-4 h-4" /> Government / Authority
                  </div>
                  <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                    {campaign.governmentActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </Card>
              </div>

              <Card className="p-5 bg-primary/5 border-primary/30">
                <div className="flex items-center gap-2 text-primary font-semibold mb-3">
                  <CheckCircle2 className="w-4 h-4" /> Do today
                </div>
                <ul className="space-y-2">
                  {campaign.doToday.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground grid place-items-center text-[11px] font-bold shrink-0">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="rounded-xl bg-card border border-border p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Social Caption</div>
                <p className="text-sm">{campaign.socialCaption}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {campaign.hashtags.map((h, i) => (
                    <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">{h}</span>
                  ))}
                </div>
              </div>

              {/* Puter.js poster generator */}
              <Card className="p-5 border-2 border-dashed border-accent/40 bg-gradient-to-br from-accent/5 to-primary/5 space-y-3">
                <div className="flex items-center gap-2 text-accent font-semibold text-sm">
                  <ImageIcon className="w-4 h-4" /> AI Poster (Puter.js)
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Prompt: {campaign.puterImagePrompt}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={generatePoster} disabled={posterLoading} className="bg-gradient-leaf shadow-glow">
                    {posterLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ImageIcon className="w-4 h-4 mr-1" />}
                    {posterUrl ? "Regenerate poster" : "Generate poster"}
                  </Button>
                  {posterUrl && (
                    <Button asChild variant="outline">
                      <a href={posterUrl} download="ecospark-poster.png" target="_blank" rel="noreferrer">
                        <Download className="w-4 h-4 mr-1" /> Download
                      </a>
                    </Button>
                  )}
                </div>
                {posterLoading && (
                  <div className="aspect-square w-full rounded-xl bg-muted grid place-items-center text-muted-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> Painting your poster…
                    </div>
                  </div>
                )}
                {posterUrl && (
                  <img
                    src={posterUrl}
                    alt={`${campaign.campaignTitle} poster`}
                    className="w-full rounded-xl shadow-leaf border border-border/60"
                  />
                )}
              </Card>

              <Button variant="outline" size="sm" onClick={() => aqi && generateCampaign(aqi)} disabled={genLoading}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate campaign
              </Button>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
