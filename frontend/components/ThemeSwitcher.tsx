import { useState } from "react";
import { Moon, Sun, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyTheme, saveTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getStoredTheme().mode);

  const switchTheme = (mode: ThemeMode) => {
    setCurrentTheme(mode);
    applyTheme(mode);
    saveTheme(mode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl hover:bg-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Switch theme"
        >
          {currentTheme === "light" && <Sun className="h-5 w-5 text-muted-foreground" />}
          {currentTheme === "dark" && <Moon className="h-5 w-5 text-muted-foreground" />}
          {currentTheme === "custom" && <Palette className="h-5 w-5 text-muted-foreground" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => switchTheme("light")}>
          <Sun className="h-4 w-4 mr-2" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchTheme("dark")}>
          <Moon className="h-4 w-4 mr-2" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchTheme("custom")}>
          <Palette className="h-4 w-4 mr-2" />
          Custom
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
