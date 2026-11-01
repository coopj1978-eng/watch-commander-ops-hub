import { Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATION_PLACE, rainChanceBetween, useStationWeather, weatherIcon, weatherLabel, windWarning,
} from "@/lib/weather";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// The weather in the shift panel (Nov 2026, John asked for it beside the
// clock in place of the dashboard's weather card): now, the chance of rain
// over the shift, and a warning when the wind matters for aerial work. Tap
// for the next five days. Built for the panel's dark background.

const dayName = (iso: string, i: number) =>
  i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" });

export function ShiftWeather({
  start, end, shiftWord, compact = false, className,
}: {
  /** The shift shown in the panel — the rain chance covers it. */
  start?: Date;
  end?: Date;
  /** "this shift" / "next shift" */
  shiftWord: string;
  compact?: boolean;
  className?: string;
}) {
  const { data } = useStationWeather();
  if (!data) return null;

  const c = data.current;
  const Icon = weatherIcon(c.weather_code, c.is_day !== 0);
  const rain = start && end ? rainChanceBetween(data, start, end) : null;
  const wind = windWarning(c.wind_speed_10m);
  const temp = Math.round(c.temperature_2m);

  const forecast = (
    <DropdownMenuContent align="end" className="w-72">
      <DropdownMenuLabel>{STATION_PLACE} · next 5 days</DropdownMenuLabel>
      <ul className="px-2 pb-2">
        {data.daily.time.slice(0, 5).map((d, i) => {
          const DayIcon = weatherIcon(data.daily.weather_code[i]);
          return (
            <li key={d} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="w-20 shrink-0">{dayName(d, i)}</span>
              <DayIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{weatherLabel(data.daily.weather_code[i])}</span>
              <span className="font-mono text-xs tabular-nums">
                {Math.round(data.daily.temperature_2m_max[i])}°<span className="text-muted-foreground">/{Math.round(data.daily.temperature_2m_min[i])}°</span>
              </span>
              <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">{data.daily.precipitation_probability_max[i]}%</span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">% = highest chance of rain that day · Open-Meteo</p>
    </DropdownMenuContent>
  );

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={cn("inline-flex items-center gap-1.5 text-left font-mono text-xs text-white/70 hover:text-white", className)}>
          <Icon className="h-3.5 w-3.5 text-white/80" />
          <span className="text-white/90">{temp}°</span> {weatherLabel(c.weather_code)}
          {rain !== null && <> · rain {rain}% {shiftWord}</>}
          {wind && <span className={wind.severe ? "text-red-300" : "text-amber-300"}> · {Math.round(c.wind_speed_10m)} mph</span>}
        </DropdownMenuTrigger>
        {forecast}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("group rounded-lg px-2 py-1 text-right transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50", className)}
        aria-label={`Weather: ${temp} degrees, ${weatherLabel(c.weather_code)}. Show the next five days.`}
      >
        <div className="flex items-center justify-end gap-2">
          <Icon className="h-7 w-7 text-white/80" />
          <span className="font-mono text-4xl font-medium tabular-nums tracking-tight text-white/90">{temp}°</span>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
          {weatherLabel(c.weather_code)} · {Math.round(c.wind_speed_10m)} mph
        </div>
        {rain !== null && (
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">
            Rain {rain}% {shiftWord}
          </div>
        )}
        {wind && (
          <div className={cn("mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium", wind.severe ? "text-red-300" : "text-amber-300")}>
            <Wind className="h-3 w-3" /> {wind.text}
          </div>
        )}
      </DropdownMenuTrigger>
      {forecast}
    </DropdownMenu>
  );
}
