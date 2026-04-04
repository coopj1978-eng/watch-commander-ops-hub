import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Wind, Droplets, X } from "lucide-react";

// ── Station config ─────────────────────────────────────────────────────────
const STATION_LAT  = 55.864;
const STATION_LON  = -4.251;
const STATION_NAME = "Glasgow";

// ── Types ──────────────────────────────────────────────────────────────────
interface OpenMeteoResponse {
  current: {
    temperature_2m:       number;
    apparent_temperature: number;
    wind_speed_10m:       number;
    relative_humidity_2m: number;
    weather_code:         number;
  };
  daily: {
    time:                          string[];
    temperature_2m_max:            number[];
    temperature_2m_min:            number[];
    weather_code:                  number[];
    precipitation_probability_max: number[];
  };
  hourly: {
    time:                     string[];
    temperature_2m:           number[];
    weather_code:             number[];
    precipitation_probability: number[];
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function weatherEmoji(code: number): string {
  if (code === 0)  return "☀️";
  if (code <= 2)   return "🌤️";
  if (code === 3)  return "☁️";
  if (code <= 48)  return "🌫️";
  if (code <= 57)  return "🌦️";
  if (code <= 67)  return "🌧️";
  if (code <= 77)  return "❄️";
  if (code <= 82)  return "🌧️";
  if (code <= 86)  return "🌨️";
  return "⛈️";
}

function weatherLabel(code: number): string {
  if (code === 0)  return "Clear sky";
  if (code <= 2)   return "Partly cloudy";
  if (code === 3)  return "Overcast";
  if (code <= 48)  return "Foggy";
  if (code <= 57)  return "Drizzle";
  if (code <= 67)  return "Rain";
  if (code <= 77)  return "Snow";
  if (code <= 82)  return "Rain showers";
  if (code <= 86)  return "Snow showers";
  return "Thunderstorm";
}

function windAlert(mph: number): { text: string; red: boolean } | null {
  if (mph >= 60) return { text: "⚠️ Severe gale — aerial ops restricted", red: true  };
  if (mph >= 40) return { text: "⚠️ Strong winds — aerial ops caution",    red: false };
  if (mph >= 25) return { text: "ℹ️ Moderate wind — monitor conditions",   red: false };
  return null;
}

function dayLabel(isoDate: string, idx: number): string {
  if (idx === 0) return "Today";
  if (idx === 1) return "Tmrw";
  return new Date(isoDate + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" });
}

function dayFull(isoDate: string, idx: number): string {
  if (idx === 0) return "Today";
  if (idx === 1) return "Tomorrow";
  return new Date(isoDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short",
  });
}

// ── Component ──────────────────────────────────────────────────────────────
export function WCWeatherWidget() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery<OpenMeteoResponse>({
    queryKey: ["weather-v3", STATION_LAT, STATION_LON],
    queryFn: async () => {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude",    String(STATION_LAT));
      url.searchParams.set("longitude",   String(STATION_LON));
      url.searchParams.set("current",     "temperature_2m,apparent_temperature,wind_speed_10m,relative_humidity_2m,weather_code");
      url.searchParams.set("daily",       "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max");
      url.searchParams.set("hourly",      "temperature_2m,weather_code,precipitation_probability");
      url.searchParams.set("wind_speed_unit",  "mph");
      url.searchParams.set("temperature_unit", "celsius");
      url.searchParams.set("forecast_days", "6");
      url.searchParams.set("timezone", "auto");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Weather fetch failed");
      return res.json();
    },
    staleTime:       1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 15,
    retry: 1,
  });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="overflow-hidden border-t-2 border-t-sky-500 animate-pulse">
        <div className="h-28 bg-gradient-to-br from-sky-200 to-indigo-200 dark:from-sky-900 dark:to-indigo-900" />
        <div className="flex divide-x divide-border/40">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 py-3">
              <div className="h-2.5 w-7 rounded bg-muted" />
              <div className="h-5 w-5 rounded bg-muted" />
              <div className="h-2.5 w-5 rounded bg-muted" />
              <div className="h-2.5 w-4 rounded bg-muted" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="overflow-hidden border-t-2 border-t-sky-500 p-5 text-sm text-muted-foreground italic">
        Weather unavailable
      </Card>
    );
  }

  const { current, daily, hourly } = data;
  const alert = windAlert(current.wind_speed_10m);

  // Build hourly slots for the selected day (06:00–23:00)
  const hourlySlots = selectedDay !== null
    ? Array.from({ length: 24 }, (_, h) => {
        const idx = selectedDay * 24 + h;
        return {
          label: `${String(h).padStart(2, "0")}:00`,
          code:  hourly.weather_code[idx]           ?? 0,
          temp:  hourly.temperature_2m[idx]          ?? 0,
          rain:  hourly.precipitation_probability[idx] ?? 0,
        };
      }).filter(s => {
        const h = parseInt(s.label);
        return h >= 6 && h <= 23;
      })
    : [];

  const handleDayClick = (i: number) =>
    setSelectedDay(prev => (prev === i ? null : i));

  return (
    <Card className="overflow-hidden border-t-2 border-t-sky-500 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">

      {/* ── Compact gradient hero ──────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 dark:from-sky-700 dark:via-blue-700 dark:to-indigo-800 p-4 text-white overflow-hidden">
        <div className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />

        <div className="relative flex items-start justify-between gap-2">
          {/* Left */}
          <div className="min-w-0">
            <div className="flex items-end leading-none gap-0.5">
              <span className="text-4xl font-bold tabular-nums">
                {Math.round(current.temperature_2m)}°
              </span>
              <span className="text-base opacity-70 mb-0.5">C</span>
            </div>
            <div className="mt-1 text-sm font-semibold opacity-90 leading-tight">
              {weatherLabel(current.weather_code)}
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs opacity-80">
                <Wind className="h-3 w-3" />
                {Math.round(current.wind_speed_10m)} mph
              </span>
              <span className="flex items-center gap-1 text-xs opacity-80">
                <Droplets className="h-3 w-3" />
                {current.relative_humidity_2m}%
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="text-right shrink-0">
            <div className="text-4xl leading-none">{weatherEmoji(current.weather_code)}</div>
            <div className="mt-1.5 text-xs opacity-60">{STATION_NAME}</div>
            <a
              href="https://www.metoffice.gov.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs opacity-40 hover:opacity-70 transition-opacity"
            >
              Met Office ↗
            </a>
          </div>
        </div>
      </div>

      {/* ── Wind alert ────────────────────────────────────────────────── */}
      {alert && (
        <div className={`px-3 py-2 text-xs font-medium border-b ${
          alert.red
            ? "bg-red-50   dark:bg-red-950/40   text-red-700   dark:text-red-300   border-red-200   dark:border-red-800"
            : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
        }`}>
          {alert.text}
        </div>
      )}

      {/* ── 6-day clickable strip ─────────────────────────────────────── */}
      <div className="flex divide-x divide-border/50">
        {daily.time.map((date, i) => {
          const rain   = daily.precipitation_probability_max[i];
          const active = selectedDay === i;
          return (
            <button
              key={date}
              onClick={() => handleDayClick(i)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-0.5 transition-colors cursor-pointer
                ${active
                  ? "bg-sky-50 dark:bg-sky-950/40 border-b-2 border-sky-500"
                  : "hover:bg-muted/50 border-b-2 border-transparent"
                }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wide ${
                active ? "text-sky-600 dark:text-sky-400" : i === 0 ? "text-foreground" : "text-muted-foreground"
              }`}>
                {dayLabel(date, i)}
              </span>
              <span className="text-lg leading-none">{weatherEmoji(daily.weather_code[i])}</span>
              <span className={`text-[10px] font-medium h-3.5 flex items-center gap-0.5 ${
                rain >= 20 ? "text-sky-500" : "text-transparent"
              }`}>
                <Droplets className="h-2 w-2" />{rain}%
              </span>
              <span className="text-xs font-bold text-foreground tabular-nums">
                {Math.round(daily.temperature_2m_max[i])}°
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {Math.round(daily.temperature_2m_min[i])}°
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Hourly panel (shown when a day is selected) ───────────────── */}
      {selectedDay !== null && (
        <div className="border-t border-border/60">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30">
            <span className="text-xs font-semibold text-foreground">
              {dayFull(daily.time[selectedDay], selectedDay)} · hourly
            </span>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
              aria-label="Close hourly view"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Scrollable hourly row */}
          <div className="flex overflow-x-auto divide-x divide-border/40 scrollbar-none">
            {hourlySlots.map(slot => (
              <div key={slot.label} className="flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2.5 min-w-[48px] hover:bg-muted/40 transition-colors">
                <span className="text-[10px] text-muted-foreground font-medium">{slot.label}</span>
                <span className="text-base leading-none">{weatherEmoji(slot.code)}</span>
                <span className="text-xs font-bold text-foreground tabular-nums">{Math.round(slot.temp)}°</span>
                <span className={`text-[10px] font-medium h-3.5 flex items-center gap-0.5 ${
                  slot.rain >= 10 ? "text-sky-500" : "text-transparent"
                }`}>
                  <Droplets className="h-2 w-2" />{slot.rain}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
