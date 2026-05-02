import { useState } from "react";
import { MapPin, Loader2, Locate, Wind, AlertTriangle, Users, Building2, CheckCircle2, Sparkles, RefreshCw } from "lucide-react";
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

interface Campaign {
  identifiedIssue: string;
  campaignTitle: string;
  slogan: string;
  whyItMatters: string;
  individualActions: string[];
  communityActions: string[];
  governmentActions: string[];
  doToday: string[];
  socialCaption: string;
  hashtags: string[];
  healthAdvice: string;
}

// US EPA AQI breakpoints for PM2.5 (μg/m³)
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
    if (c >= cl && c <= ch) {
      return Math.round(((ih - il) / (ch - cl)) * (c - cl) + il);
    }
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

async function geocode(city: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  const d = await r.json();
  if (!d.results?.length) return null;
  const x = d.results[0];
  return { lat: x.latitude, lon: x.longitude, name: `${x.name}${x.admin1 ? ", " + x.admin1 : ""}, ${x.country}` };
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`
    );
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
  // dominant pollutant by relative threshold
  const pollutants: Record<string, number> = {
    "PM2.5": (c.pm2_5 ?? 0) / 35,
    "PM10": (c.pm10 ?? 0) / 150,
    "Ozone": (c.ozone ?? 0) / 100,
    "NO₂": (c.nitrogen_dioxide ?? 0) / 100,
    "SO₂": (c.sulphur_dioxide ?? 0) / 75,
    "CO": (c.carbon_monoxide ?? 0) / 9000,
  };
  const dominant = Object.entries(pollutants).sort((a, b) => b[1] - a[1])[0][0];
  return {
    city: name,
    aqi,
    category: cat.category,
    color: cat.color,
    dominant,
    pm25: c.pm2_5 ?? 0,
    pm10: c.pm10 ?? 0,
    lat,
    lon,
  };
}

export function AqiCampaign() {
  const { settings, setLastModelUsed } = useSettings();
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [aqi, setAqi] = useState<AqiData | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const loadByCity = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!city.trim()) return toast.error("Enter a city name");
    setLoading(true);
    setCampaign(null);
    try {
      const g = await geocode(city.trim());
      if (!g) {
        toast.error("City not found");
        return;
      }
      const data = await fetchAqi(g.lat, g.lon, g.name);
      setAqi(data);
      generateCampaign(data);
    } catch {
      toast.error("Couldn't fetch air quality data.");
    } finally {
      setLoading(false);
    }
  };

  const loadByLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setLoading(true);
    setCampaign(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          const data = await fetchAqi(pos.coords.latitude, pos.coords.longitude, name);
          setAqi(data);
          generateCampaign(data);
        } catch {
          toast.error("Couldn't fetch air quality.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        toast.error("Location permission denied");
        setLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const generateCampaign = async (data: AqiData) => {
    setGenLoading(true);
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
      const cleaned = text.replace(/```json|```/g, "").trim();
      setCampaign(JSON.parse(cleaned));
    } catch {
      toast.error("Couldn't generate campaign. Try again.");
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <section id="quiz" className="py-24 bg-gradient-earth">
      <div className="container max-w-4xl">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 text-accent text-sm font-semibold uppercase tracking-widest">
            <Wind className="w-4 h-4" /> Live AQI Campaign
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold">
            Your city. Your air. <span className="text-gradient-leaf">Your action.</span>
          </h2>
          <p className="text-muted-foreground">
            Enter a location or use your live position. We pull real-time air quality from Open-Meteo and turn it into a tailored awareness campaign.
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
                Source: Open-Meteo Air Quality API (CAMS European data) · Live
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

              {campaign.healthAdvice && (
                <div className="rounded-xl border-l-4 border-accent bg-accent/10 p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm mb-1">Health advice for current AQI</div>
                    <p className="text-sm text-muted-foreground">{campaign.healthAdvice}</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-muted p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Why it matters here</div>
                <p className="text-sm">{campaign.whyItMatters}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Sparkles className="w-4 h-4" /> Individuals
                  </div>
                  <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                    {campaign.individualActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </Card>
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Users className="w-4 h-4" /> Community
                  </div>
                  <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                    {campaign.communityActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </Card>
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Building2 className="w-4 h-4" /> Authorities
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
