import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTheme, saveTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";

export default function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredTheme().mode);

  const toggle = () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyTheme(next);
    saveTheme(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-10 w-10 rounded-xl hover:bg-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={toggle}
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mode === "dark"
        ? <Sun className="h-5 w-5 text-amber-400" />
        : <Moon className="h-5 w-5 text-muted-foreground" />
      }
    </Button>
  );
}
