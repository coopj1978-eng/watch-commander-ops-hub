import { ChevronDown, Lock, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The calendar page's "Calendars" menu (Nov 2026) — which calendars and
// overlays show, and (WC/CC) whose watch calendar. It replaces the old left
// panel, whose mini month repeated the main grid.

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;

// Yours first, then the watch's, then the station's (Nov 2026).
export const CALENDAR_LAYERS = [
  { key: "personal", label: "My calendar", sub: "Only you, plus your shifts and bookings", dot: "var(--cal-personal-dot)" },
  { key: "watch", label: "Watch calendar", sub: "", dot: "var(--cal-watch-dot)" },
  { key: "station", label: "Springburn Station", sub: "Everyone", dot: "var(--cal-station-dot)" },
] as const;

const OVERLAYS = [
  { key: "tasks", label: "My tasks", dot: "var(--cal-tasks-dot)" },
  { key: "inspections", label: "Inspections", dot: "var(--cal-insp-dot)" },
] as const;

interface CalendarFiltersProps {
  visible: Set<string>;
  onToggle: (key: string) => void;
  watchShown: string;
  userWatch: string;
  isManager: boolean;
  onWatchChange: (w: string) => void;
  /** Make the trigger fill its row (phones). */
  compact?: boolean;
}

const Swatch = ({ colour, on }: { colour: string; on: boolean }) => (
  <span
    aria-hidden
    style={{
      width: 10, height: 10, borderRadius: 3, flex: "none",
      background: on ? colour : "transparent", boxShadow: on ? undefined : `inset 0 0 0 2px ${colour}`,
    }}
  />
);

export default function CalendarFilters({
  visible, onToggle, watchShown, userWatch, isManager, onWatchChange, compact,
}: CalendarFiltersProps) {
  // Keep the menu open while ticking several.
  const keepOpen = (e: Event) => e.preventDefault();
  const shownLayers = [...CALENDAR_LAYERS, ...OVERLAYS].filter((l) => visible.has(l.key));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="cal-btn"
          style={{ height: 40, padding: "0 12px", fontSize: 14, gap: 8, whiteSpace: "nowrap" }}
          aria-label="Choose calendars"
        >
          <span style={{ display: "inline-flex" }} aria-hidden>
            {shownLayers.slice(0, 4).map((l, i) => (
              <span
                key={l.key}
                style={{
                  width: 10, height: 10, borderRadius: "50%", background: l.dot,
                  marginLeft: i ? -3 : 0, boxShadow: "0 0 0 2px var(--cal-surface)",
                }}
              />
            ))}
          </span>
          {/* Phones are tight: the watch name (WC/CC can switch it), else just the dots. */}
          {!compact && <span>Calendars</span>}
          {compact && isManager && watchShown && <span>{watchShown}</span>}
          <ChevronDown className="h-4 w-4" style={{ color: "var(--cal-muted)" }} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="w-72 p-1.5">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calendars</DropdownMenuLabel>
        {CALENDAR_LAYERS.map((l) => (
          <DropdownMenuCheckboxItem
            key={l.key}
            checked={visible.has(l.key)}
            onCheckedChange={() => onToggle(l.key)}
            onSelect={keepOpen}
            className="py-2"
          >
            <Swatch colour={l.dot} on={visible.has(l.key)} />
            <span className="flex-1">
              <span className="block text-sm font-medium">{l.label}</span>
              <span className="block text-xs text-muted-foreground">
                {l.key === "watch" ? `${watchShown || "Your"} Watch` : l.sub}
              </span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}

        {isManager && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Whose watch calendar
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={watchShown} onValueChange={onWatchChange}>
              <div className="grid grid-cols-5 gap-1 px-1 pb-1">
                {WATCHES.map((w) => (
                  <DropdownMenuRadioItem
                    key={w}
                    value={w}
                    onSelect={keepOpen}
                    className="justify-center rounded-md py-1.5 pl-2 pr-2 text-xs data-[state=checked]:bg-accent data-[state=checked]:font-semibold [&>span:first-child]:hidden"
                    title={w === userWatch ? `${w} (yours)` : w}
                  >
                    {w}
                  </DropdownMenuRadioItem>
                ))}
              </div>
            </DropdownMenuRadioGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Overlays · read-only
        </DropdownMenuLabel>
        {OVERLAYS.map((l) => (
          <DropdownMenuCheckboxItem
            key={l.key}
            checked={visible.has(l.key)}
            onCheckedChange={() => onToggle(l.key)}
            onSelect={keepOpen}
          >
            <Swatch colour={l.dot} on={visible.has(l.key)} />
            <span className="flex-1 text-sm">{l.label}</span>
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuCheckboxItem>
        ))}
        {watchShown && (
          <DropdownMenuCheckboxItem
            checked={visible.has("shifts")}
            onCheckedChange={() => onToggle("shifts")}
            onSelect={keepOpen}
          >
            <Swatch colour="var(--cal-ink-2)" on={visible.has("shifts")} />
            <span className="flex-1 text-sm">Shift rota · {watchShown}</span>
          </DropdownMenuCheckboxItem>
        )}
        {watchShown && visible.has("shifts") && (
          <div className="flex flex-wrap gap-1.5 px-2 pb-1.5 pt-1 text-[11px] font-medium">
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: "var(--cal-day-bg)", color: "var(--cal-day-fg)" }}>
              <Sun className="h-3 w-3" /> Day 08–18
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: "var(--cal-night-bg)", color: "var(--cal-night-fg)" }}>
              <Moon className="h-3 w-3" /> Night 18–08
            </span>
            <span className="rounded-full px-2 py-0.5" style={{ background: "var(--cal-leave-bg)", color: "var(--cal-leave-fg)" }}>Leave</span>
            <span className="rounded-full border border-dashed px-2 py-0.5 text-muted-foreground">Rest</span>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
