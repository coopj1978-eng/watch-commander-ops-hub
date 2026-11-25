import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getShiftForDate } from "@/lib/shiftRota";
import { monthGrid, shiftPick, type ShiftPickDay } from "@/lib/shiftPicker";

// ──────────────────────────────────────────────────────────────────────────────
// ShiftDatePicker — pick a shift, not just a date (Nov 2026).
//
// "Shift you want off" was a plain date box: nothing stopped you picking a
// rest day, and on an iPhone it was Safari's own picker (blank until tapped,
// and it wouldn't size to the form). This shows the month with the watch's
// own rota on it — a bar under each day for a day shift, night shift or
// leave — and only the days that watch is actually on can be picked.
//
// It opens in place under the box (the form it sits in is already a pop-up).
// A watch with no rota in the app falls back to the plain date box.
// The rules for what can be picked are in lib/shiftPicker.ts (tested).
// ──────────────────────────────────────────────────────────────────────────────

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const BAR: Record<NonNullable<ShiftPickDay["kind"]>, string> = {
  day: "var(--cal-day-dot)",
  night: "var(--cal-night-dot)",
  leave: "var(--cal-leave-dot)",
};

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function ShiftDatePicker({ id, value, onChange, watch, allowLeave = false, placeholder = "Pick a shift" }: {
  id?: string;
  /** "YYYY-MM-DD", or "" for none. */
  value: string;
  onChange: (iso: string) => void;
  /** Whose rota to show. */
  watch: string;
  /** Annual leave days can be picked too (a Head for Head can swap one). */
  allowLeave?: boolean;
  placeholder?: string;
}) {
  const today = new Date();
  const start = value ? new Date(`${value}T12:00:00`) : today;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });

  const hasRota = !!watch && !!getShiftForDate(watch, today);
  if (!hasRota) {
    return (
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-slot="input"
        className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm"
      />
    );
  }

  const picked = value ? shiftPick(watch, value, allowLeave) : null;
  const days = monthGrid(view.y, view.m).map((iso) => shiftPick(watch, iso, allowLeave));
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const step = (by: number) => setView((v) => { const d = new Date(v.y, v.m + by, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div>
      <button
        id={id}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-left text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
      >
        {value ? (
          <span className="min-w-0">
            <span className="font-medium">{longDate(value)}</span>
            {picked?.label && <span className="text-muted-foreground"> · {picked.label}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border/70 bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => step(-1)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold" aria-live="polite">
              {new Date(view.y, view.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </p>
            <button type="button" aria-label="Next month" onClick={() => step(1)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center font-mono text-[11px] text-muted-foreground" aria-hidden="true">
            {WEEKDAYS.map((d, i) => <span key={i} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((d) => {
              const inMonth = Number(d.iso.slice(5, 7)) - 1 === view.m;
              const isPicked = d.iso === value;
              return (
                <button
                  key={d.iso}
                  type="button"
                  disabled={!d.canPick}
                  aria-pressed={isPicked}
                  aria-label={`${longDate(d.iso)}${d.label ? `, ${d.label}` : ", not on shift"}`}
                  onClick={() => { onChange(d.iso); setOpen(false); }}
                  className={cn(
                    "relative mx-auto flex h-11 w-full max-w-11 flex-col items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                    !inMonth && "opacity-40",
                    d.canPick ? "font-semibold hover:bg-muted active:bg-muted" : "text-muted-foreground/60",
                    isPicked && "bg-brand text-brand-foreground hover:bg-brand active:bg-brand",
                    d.iso === todayIso && !isPicked && "ring-1 ring-inset ring-foreground/40",
                  )}
                >
                  {Number(d.iso.slice(8))}
                  <span
                    aria-hidden="true"
                    className="mt-0.5 h-[3px] w-4 rounded-full"
                    style={{ background: d.kind ? (isPicked ? "currentColor" : BAR[d.kind]) : "transparent", opacity: d.kind === "leave" && !allowLeave ? 0.45 : 1 }}
                  />
                </button>
              );
            })}
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><i className="h-[3px] w-4 rounded-full" style={{ background: BAR.day }} />Day</span>
            <span className="inline-flex items-center gap-1"><i className="h-[3px] w-4 rounded-full" style={{ background: BAR.night }} />Night</span>
            <span className="inline-flex items-center gap-1"><i className="h-[3px] w-4 rounded-full" style={{ background: BAR.leave }} />Leave</span>
            <span>{watch} Watch's shifts. {allowLeave ? "Rest days can't be picked." : "Only shifts can be picked."}</span>
          </p>
        </div>
      )}
    </div>
  );
}
