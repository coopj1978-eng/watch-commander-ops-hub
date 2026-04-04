import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Keys that should never trigger shortcuts
const IGNORED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

const SHORTCUTS: Array<{
  key: string;
  label: string;
  description: string;
  action: (navigate: ReturnType<typeof useNavigate>) => void;
}> = [
  { key: "d", label: "D", description: "Go to Dashboard",   action: nav => nav("/") },
  { key: "h", label: "H", description: "Go to Handover",    action: nav => nav("/handover?tab=handover") },
  { key: "c", label: "C", description: "Go to Crewing",     action: nav => nav("/handover?tab=crewing") },
  { key: "t", label: "T", description: "Go to Tasks",       action: nav => nav("/tasks") },
  { key: "p", label: "P", description: "Go to People",      action: nav => nav("/people") },
  { key: "g", label: "G", description: "Go to Targets",     action: nav => nav("/targets") },
  { key: "n", label: "N", description: "New task",          action: nav => nav("/tasks?new=1") },
  { key: "?", label: "?", description: "Show this help",    action: () => {} }, // handled separately
];

export { SHORTCUTS };

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if focus is inside a form element or contentEditable
      const target = e.target as HTMLElement;
      if (IGNORED_TAGS.has(target.tagName) || target.isContentEditable) return;
      // Ignore if any modifier key is held
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === "?") {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }

      if (key === "escape") {
        setShowHelp(false);
        return;
      }

      const shortcut = SHORTCUTS.find(s => s.key === key && s.key !== "?");
      if (shortcut) {
        e.preventDefault();
        shortcut.action(navigate);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return { showHelp, setShowHelp };
}
