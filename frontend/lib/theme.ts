export type ThemeMode = "light" | "dark" | "custom";

export interface CustomColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  muted: string;
  mutedForeground: string;
}

export const defaultLightColors: CustomColors = {
  primary: "#6366f1",
  secondary: "#8b5cf6",
  accent: "#ec4899",
  background: "#f5f5f7",
  foreground: "#1f2937",
  card: "#ffffff",
  cardForeground: "#1f2937",
  border: "#e5e7eb",
  muted: "#f3f4f6",
  mutedForeground: "#6b7280",
};

export const defaultDarkColors: CustomColors = {
  primary: "#818cf8",
  secondary: "#a78bfa",
  accent: "#f472b6",
  background: "#0f172a",
  foreground: "#f1f5f9",
  card: "#1e293b",
  cardForeground: "#f1f5f9",
  border: "#334155",
  muted: "#1e293b",
  mutedForeground: "#94a3b8",
};

export function applyTheme(mode: ThemeMode, customColors?: Partial<CustomColors>) {
  const root = document.documentElement;
  
  if (mode === "dark") {
    root.classList.add("dark");
    root.classList.remove("light", "custom");
  } else if (mode === "light") {
    root.classList.add("light");
    root.classList.remove("dark", "custom");
  } else if (mode === "custom" && customColors) {
    root.classList.add("custom");
    root.classList.remove("dark", "light");
    
    const baseColors = root.classList.contains("dark")
      ? defaultDarkColors
      : defaultLightColors;
    const colors = { ...baseColors, ...customColors };
    
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--secondary", colors.secondary);
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--background", colors.background);
    root.style.setProperty("--foreground", colors.foreground);
    root.style.setProperty("--card", colors.card);
    root.style.setProperty("--card-foreground", colors.cardForeground);
    root.style.setProperty("--border", colors.border);
    root.style.setProperty("--muted", colors.muted);
    root.style.setProperty("--muted-foreground", colors.mutedForeground);
  }
}

export function getStoredTheme(): { mode: ThemeMode; customColors?: Partial<CustomColors> } {
  const stored = localStorage.getItem("theme");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { mode: "light" };
    }
  }
  return { mode: "light" };
}

export function saveTheme(mode: ThemeMode, customColors?: Partial<CustomColors>) {
  localStorage.setItem("theme", JSON.stringify({ mode, customColors }));
}
