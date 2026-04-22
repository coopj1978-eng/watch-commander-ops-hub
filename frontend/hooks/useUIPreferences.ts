import { useCallback, useEffect, useState } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// User-pickable UI preferences (accent colour + density)
//
// Both preferences are stored per-device in localStorage — deliberately not
// synced to the backend. A logged-in user who wants the same preference on
// a second device sets it again. Matches the behaviour of the light/dark
// theme toggle already in the app.
//
// The preferences apply to the whole document by setting data attributes on
// <html>. CSS variables defined in index.css react to those attributes and
// propagate the change across the UI instantly.
// ──────────────────────────────────────────────────────────────────────────────

// ── Accent colour ────────────────────────────────────────────────────────────

export const ACCENT_OPTIONS = [
  { key: "indigo",  label: "Indigo",  swatch: "oklch(0.48 0.16 268)" },
  { key: "oxblood", label: "Oxblood", swatch: "oklch(0.42 0.14 14)"  },
  { key: "blue",    label: "Blue",    swatch: "oklch(0.42 0.13 248)" },
  { key: "teal",    label: "Teal",    swatch: "oklch(0.38 0.09 190)" },
  { key: "forest",  label: "Forest",  swatch: "oklch(0.35 0.08 155)" },
  { key: "amber",   label: "Amber",   swatch: "oklch(0.55 0.14 70)"  },
] as const;

export type AccentKey = typeof ACCENT_OPTIONS[number]["key"];

const ACCENT_STORAGE_KEY = "ui-accent";
const DEFAULT_ACCENT: AccentKey = "indigo";

function readAccent(): AccentKey {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    const v = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (v && ACCENT_OPTIONS.some((a) => a.key === v)) return v as AccentKey;
  } catch { /* localStorage blocked — fall through to default */ }
  return DEFAULT_ACCENT;
}

function applyAccent(key: AccentKey) {
  if (typeof document === "undefined") return;
  // Indigo is the default: we remove the attribute rather than set it so the
  // :root CSS variable applies without needing a specific selector. Every
  // other option gets `data-accent="..."` on <html>.
  if (key === "indigo") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", key);
  }
}

export function useAccent(): [AccentKey, (k: AccentKey) => void] {
  const [accent, setAccentState] = useState<AccentKey>(readAccent);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  const setAccent = useCallback((k: AccentKey) => {
    setAccentState(k);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, k); } catch { /* ignore */ }
  }, []);

  return [accent, setAccent];
}

// ── Density ──────────────────────────────────────────────────────────────────

export const DENSITY_OPTIONS = [
  { key: "compact",     label: "Compact",     description: "Tighter rows + padding — best on a big monitor" },
  { key: "comfortable", label: "Comfortable", description: "App default" },
  { key: "airy",        label: "Airy",        description: "Roomy spacing — easier on the eyes" },
] as const;

export type DensityKey = typeof DENSITY_OPTIONS[number]["key"];

const DENSITY_STORAGE_KEY = "ui-density";
const DEFAULT_DENSITY: DensityKey = "comfortable";

function readDensity(): DensityKey {
  if (typeof window === "undefined") return DEFAULT_DENSITY;
  try {
    const v = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (v && DENSITY_OPTIONS.some((d) => d.key === v)) return v as DensityKey;
  } catch { /* ignore */ }
  return DEFAULT_DENSITY;
}

function applyDensity(key: DensityKey) {
  if (typeof document === "undefined") return;
  if (key === "comfortable") {
    document.documentElement.removeAttribute("data-density");
  } else {
    document.documentElement.setAttribute("data-density", key);
  }
}

export function useDensity(): [DensityKey, (k: DensityKey) => void] {
  const [density, setDensityState] = useState<DensityKey>(readDensity);

  useEffect(() => {
    applyDensity(density);
  }, [density]);

  const setDensity = useCallback((k: DensityKey) => {
    setDensityState(k);
    try { localStorage.setItem(DENSITY_STORAGE_KEY, k); } catch { /* ignore */ }
  }, []);

  return [density, setDensity];
}

// ── Bootstrap — called once during app init to apply saved prefs before the
//   first paint so the user never sees a flash of default styling.
export function bootstrapUIPreferences() {
  applyAccent(readAccent());
  applyDensity(readDensity());
}
