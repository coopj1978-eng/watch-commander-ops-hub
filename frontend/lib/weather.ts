import { useQuery } from "@tanstack/react-query";
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun, type LucideIcon,
} from "lucide-react";

// The station's weather from Open-Meteo (free, no key): now, hourly for the
// shift window, and the next few days. Shown in the shift panel (Nov 2026 —
// it replaced the dashboard's weather card).

export const STATION_LAT = 55.864;
export const STATION_LON = -4.251;
export const STATION_PLACE = "Glasgow";

export interface StationWeather {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
    weather_code: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
  };
}

export function useStationWeather() {
  return useQuery<StationWeather>({
    queryKey: ["weather-v3", STATION_LAT, STATION_LON],
    queryFn: async () => {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(STATION_LAT));
      url.searchParams.set("longitude", String(STATION_LON));
      url.searchParams.set("current", "temperature_2m,apparent_temperature,wind_speed_10m,relative_humidity_2m,weather_code");
      url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max");
      url.searchParams.set("hourly", "temperature_2m,weather_code,precipitation_probability");
      url.searchParams.set("wind_speed_unit", "mph");
      url.searchParams.set("temperature_unit", "celsius");
      url.searchParams.set("forecast_days", "6");
      url.searchParams.set("timezone", "auto");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Weather fetch failed");
      return res.json();
    },
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  });
}

export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

export function weatherIcon(code: number): LucideIcon {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67) return CloudRain;
  if (code <= 77) return Snowflake;
  if (code <= 82) return CloudRain;
  if (code <= 86) return Snowflake;
  return CloudLightning;
}

/** Wind that matters for aerial work. */
export function windWarning(mph: number): { text: string; severe: boolean } | null {
  if (mph >= 60) return { text: "Severe gale — aerial ops restricted", severe: true };
  if (mph >= 40) return { text: "Strong winds — aerial ops caution", severe: false };
  if (mph >= 25) return { text: "Moderate wind — monitor", severe: false };
  return null;
}

/** The highest chance of rain in any hour between start and end, or null if the forecast doesn't reach. */
export function rainChanceBetween(w: StationWeather, start: Date, end: Date): number | null {
  let max: number | null = null;
  w.hourly.time.forEach((t, i) => {
    const at = new Date(t).getTime();
    if (at >= start.getTime() - 3_600_000 && at < end.getTime()) {
      max = Math.max(max ?? 0, w.hourly.precipitation_probability[i] ?? 0);
    }
  });
  return max;
}
