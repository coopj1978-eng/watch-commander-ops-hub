import { useRef } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Loader2, Moon, Sparkles, Sun } from "lucide-react";
import type { crewing } from "@/client";
import { cn } from "@/lib/utils";
import { getShiftForDate, hasRotaConfig } from "@/lib/shiftRota";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ShiftType = crewing.ShiftType;

// One control for "which board am I looking at": ‹ Sat 31 Oct · 1st Night ›
// steps through the watch's rota shifts (skipping rest days and leave), the
// date opens a calendar, Now jumps back to the shift running. Replaces the
// watch dropdown + date box + 4-way shift grid + the repeated date heading.

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;
const TYPES: ShiftType[] = ["1st Day", "2nd Day", "1st Night", "2nd Night"];

/** The watch's next (dir 1) or previous (-1) rostered shift from a date. */
export function stepShift(watch: string, date: string, type: ShiftType, dir: 1 | -1): { date: string; type: ShiftType } {
  const d = new Date(`${date}T12:00:00`);
  if (hasRotaConfig(watch)) {
    for (let i = 1; i <= 60; i++) {
      const t = new Date(d);
      t.setDate(d.getDate() + dir * i);
      const s = getShiftForDate(watch, t);
      if (s?.isWorking) return { date: s.date, type: s.shiftType as ShiftType };
    }
  }
  const t = new Date(d);
  t.setDate(d.getDate() + dir);
  return { date: format(t, "yyyy-MM-dd"), type };
}

/** The rota's shift type for a date, if the watch works it. */
export function rotaTypeFor(watch: string, date: string): ShiftType | null {
  const s = hasRotaConfig(watch) ? getShiftForDate(watch, new Date(`${date}T12:00:00`)) : null;
  return s?.isWorking ? (s.shiftType as ShiftType) : null;
}

export function ShiftNavigator({
  watch, onWatch, canChangeWatch, date, type, onChange, isNow, onNow,
  canEdit, onCopy, copyPending, onAutoCrew, openSeats,
}: {
  watch: string;
  onWatch: (w: string) => void;
  canChangeWatch: boolean;
  date: string;
  type: ShiftType;
  onChange: (date: string, type: ShiftType) => void;
  isNow: boolean;
  onNow: () => void;
  canEdit: boolean;
  onCopy: () => void;
  copyPending: boolean;
  onAutoCrew: () => void;
  openSeats: number;
}) {
  const dateRef = useRef<HTMLInputElement>(null);
  const night = type.includes("Night");
  const hasRota = hasRotaConfig(watch);
  const go = (dir: 1 | -1) => { const n = stepShift(watch, date, type, dir); onChange(n.date, n.type); };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* ‹ date · shift › */}
      <div className="relative flex min-w-0 items-center rounded-xl border border-border/80 bg-card shadow-sm">
        <button onClick={() => go(-1)} className="grid h-11 w-10 place-items-center rounded-l-xl hover:bg-muted" aria-label="Previous shift">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => { const el = dateRef.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); } }}
          className="flex min-w-0 items-center gap-2.5 border-x border-border/60 px-3 py-1.5 text-left hover:bg-muted/50"
          aria-label="Choose a date"
        >
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", night ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")}>
            {night ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">{format(parseISO(date), "EEE d MMM")} · {type}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{watch} Watch · {night ? "18:00–08:00" : "08:00–18:00"}</span>
          </span>
          <CalendarDays className="ml-1 hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
        </button>
        <input
          ref={dateRef}
          type="date"
          value={date}
          onChange={(e) => { if (e.target.value) onChange(e.target.value, rotaTypeFor(watch, e.target.value) ?? type); }}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          tabIndex={-1}
          aria-hidden
        />
        <button onClick={() => go(1)} className="grid h-11 w-10 place-items-center rounded-r-xl hover:bg-muted" aria-label="Next shift">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!isNow && (
        <Button variant="outline" size="sm" onClick={onNow} className="h-9">Now</Button>
      )}

      {/* No rota for this watch → pick the shift by hand */}
      {!hasRota && (
        <div className="seg" style={{ width: 300 }}>
          {TYPES.map((t) => (
            <button key={t} data-on={t === type} onClick={() => onChange(date, t)}>{t}</button>
          ))}
        </div>
      )}

      {canChangeWatch && (
        <Select value={watch} onValueChange={onWatch}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {WATCHES.map((w) => <SelectItem key={w} value={w}>{w} Watch</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {canEdit && (
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onCopy} disabled={copyPending}>
            {copyPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
            Copy last {type}
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90" onClick={onAutoCrew} disabled={openSeats === 0}>
            <Sparkles className="h-3.5 w-3.5" />
            Auto-crew{openSeats > 0 ? ` ${openSeats}` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
