import { useState } from "react";
import { applyTheme, saveTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";

/** Light / dark, remembered on this device. Used by the account menu and the phone's More sheet. */
export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredTheme().mode);
  const isDark = mode === "dark";

  const toggle = () => {
    const next: ThemeMode = isDark ? "light" : "dark";
    setMode(next);
    applyTheme(next);
    saveTheme(next);
  };

  return { isDark, toggle };
}
