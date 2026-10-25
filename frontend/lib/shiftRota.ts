/**
 * shiftRota.ts — 5WDS (Five Watch Day Shift) rota engine
 *
 * Pattern: 2 Day shifts (08:00–18:00) → 2 Night shifts (18:00–08:00) → 4 Rest days
 * Repeating 7 times, then 18 days Annual Leave (which absorbs the last 4 rest days),
 * always returning on a Monday.
 *
 * Mega-cycle = 70 calendar days (one Monday-return to the next):
 *   Days  0–51 : 7 repeats × 8-day sub-cycle (pos%8: 0=1stDay, 1=2ndDay, 2=1stNight, 3=2ndNight, 4-7=Rest)
 *   Days 52–69 : Annual Leave (18 days — absorbs the last 4 rest days of cycle 7)
 *   Day  70    : Next Monday return (pos = 0 again)
 *
 * Verified against the 5WDS 2026 Calendar (Scottish Fire and Rescue Service).
 *
 * Reference Mondays (first confirmed return-from-leave in 2026 for each watch):
 *   Amber : 2026-02-09  (returns Mon 9 Feb; prev leave Jan 22 – Feb 8)
 *   Green : 2026-02-23  (returns Mon 23 Feb; prev leave Feb 5 – 22)
 *   Blue  : 2026-03-09  (returns Mon 9 Mar; prev leave Feb 19 – Mar 8)
 *   Red   : 2026-03-23  (returns Mon 23 Mar; prev leave Mar 5 – 22)
 *   White : 2026-04-06  (returns Mon 6 Apr; prev leave Mar 19 – Apr 5)
 */

export type ShiftType =
  | "1st Day"
  | "2nd Day"
  | "1st Night"
  | "2nd Night"
  | "Annual Leave"
  | "Rest";

export interface ShiftDay {
  date: string;        // ISO "YYYY-MM-DD"
  shiftType: ShiftType;
  isWorking: boolean;  // true for Day or Night shifts
  isLeave: boolean;    // true for Annual Leave
  startTime?: string;  // "08:00" or "18:00"
  endTime?: string;    // "18:00" or "08:00" (next day)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEGA_CYCLE  = 70; // days from one Monday-return to the next
const LEAVE_START = 52; // day 52 onward = Annual Leave (18 days)

// ─── Reference Mondays for each watch ────────────────────────────────────────

/** A confirmed Monday on which the watch returns from annual leave. */
const REFERENCE_MONDAYS: Record<string, string> = {
  Amber: "2026-02-09",
  Green: "2026-02-23",
  Blue:  "2026-03-09",
  Red:   "2026-03-23",
  White: "2026-04-06",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Integer day difference: positive = date is after base. */
function diffDays(date: Date, base: Date): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((a - b) / 86_400_000);
}

function toDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoString(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

// ─── Core algorithm ───────────────────────────────────────────────────────────

function computeShiftForDate(date: Date, refMonday: Date): ShiftDay {
  const dateStr = isoString(date);
  const diff    = diffDays(date, refMonday);

  // Map any diff (positive or negative) into [0, MEGA_CYCLE)
  const pos = ((diff % MEGA_CYCLE) + MEGA_CYCLE) % MEGA_CYCLE;

  // Annual Leave: days 52–69 (absorbs the last 4 rest days of cycle 7)
  if (pos >= LEAVE_START) {
    return { date: dateStr, shiftType: "Annual Leave", isWorking: false, isLeave: true };
  }

  // Active cycles: 7 repeats of 8-day sub-cycle (days 0–51)
  const inRepeat = pos % 8;
  if (inRepeat === 0) return { date: dateStr, shiftType: "1st Day",   isWorking: true,  isLeave: false, startTime: "08:00", endTime: "18:00" };
  if (inRepeat === 1) return { date: dateStr, shiftType: "2nd Day",   isWorking: true,  isLeave: false, startTime: "08:00", endTime: "18:00" };
  if (inRepeat === 2) return { date: dateStr, shiftType: "1st Night", isWorking: true,  isLeave: false, startTime: "18:00", endTime: "08:00" };
  if (inRepeat === 3) return { date: dateStr, shiftType: "2nd Night", isWorking: true,  isLeave: false, startTime: "18:00", endTime: "08:00" };

  // inRepeat 4–7: Rest days
  return { date: dateStr, shiftType: "Rest", isWorking: false, isLeave: false };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the shift for every day in [from, to] for the given watch.
 * Rest days are excluded so the calendar view stays clean.
 */
/**
 * Compute the shift for one specific date for the given watch.
 * Returns null if the watch has no rota config, otherwise always returns a
 * ShiftDay (including Rest days — callers decide whether to display them).
 */
export function getShiftForDate(watch: string, date: Date): ShiftDay | null {
  const refIso = REFERENCE_MONDAYS[watch];
  if (!refIso) return null;
  const refMonday = toDateOnly(refIso);
  // Normalise date to local midnight so time-of-day never shifts the day boundary
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return computeShiftForDate(localMidnight, refMonday);
}

export function getShiftsForDateRange(
  watch: string,
  from: Date,
  to: Date,
): ShiftDay[] {
  const refIso = REFERENCE_MONDAYS[watch];
  if (!refIso) return [];

  const refMonday = toDateOnly(refIso);
  const results: ShiftDay[] = [];
  const current = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endDay  = new Date(to.getFullYear(),   to.getMonth(),   to.getDate());

  while (current <= endDay) {
    const shift = computeShiftForDate(current, refMonday);
    if (shift.shiftType !== "Rest") {
      results.push(shift);
    }
    current.setDate(current.getDate() + 1);
  }

  return results;
}

/**
 * Returns today's shift for the given watch, or null if not configured.
 */
export function getTodayShift(watch: string): ShiftDay | null {
  const refIso = REFERENCE_MONDAYS[watch];
  if (!refIso) return null;
  const today = new Date();
  const refMonday = toDateOnly(refIso);
  return computeShiftForDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    refMonday,
  );
}

/**
 * Returns true if this watch has a configured rota.
 */
export function hasRotaConfig(watch: string): boolean {
  return watch in REFERENCE_MONDAYS;
}

// ─── Where a watch stands right now ───────────────────────────────────────────

export interface WatchShiftStatus {
  /** on = a shift is running; off = between shifts on a working day; rest / leave = not working today. */
  state: "on" | "off" | "rest" | "leave";
  /** The shift running now (state "on"). A night started yesterday still runs until 08:00. */
  current?: ShiftDay;
  /** The next shift to start. */
  next?: ShiftDay;
  /** Short heading, e.g. "2nd Night · 18:00–08:00", "Off now", "Rest day", "Annual leave". */
  label: string;
  /** When the next shift starts, e.g. "2nd Night starts 18:00", "1st Day Mon 26 Oct 08:00". */
  nextLabel?: string;
}

function shiftStart(s: ShiftDay): Date {
  const [h, m] = (s.startTime ?? "08:00").split(":").map(Number);
  const d = toDateOnly(s.date);
  d.setHours(h, m, 0, 0);
  return d;
}

function shiftEnd(s: ShiftDay): Date {
  const end = shiftStart(s);
  end.setHours(end.getHours() + (s.startTime === "18:00" ? 14 : 10));
  return end;
}

function describeStart(s: ShiftDay, now: Date): string {
  const days = diffDays(toDateOnly(s.date), now);
  const when =
    days === 0 ? "" :
    days === 1 ? " tomorrow" :
    " " + toDateOnly(s.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${s.shiftType}${when ? when : " starts"} ${s.startTime}`;
}

/**
 * Where a watch stands at `now`, from its rota: on a shift, off between
 * shifts, on a rest day or on leave — plus the next shift. Uses the
 * watch's own rota, so every watch sees its own position. Null when the
 * watch has no rota.
 */
export function getWatchShiftStatus(watch: string, now: Date = new Date()): WatchShiftStatus | null {
  const refIso = REFERENCE_MONDAYS[watch];
  if (!refIso) return null;
  const refMonday = toDateOnly(refIso);
  const dayAt = (offset: number) =>
    computeShiftForDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset), refMonday);

  // Yesterday's night runs until 08:00 today; today's shift may be running.
  const running = [dayAt(-1), dayAt(0)].find(
    (s) => s.isWorking && shiftStart(s) <= now && now < shiftEnd(s)
  );

  // Next shift to start, looking far enough ahead to clear annual leave.
  let next: ShiftDay | undefined;
  for (let i = 0; i <= MEGA_CYCLE; i++) {
    const s = dayAt(i);
    if (s.isWorking && shiftStart(s) > now) { next = s; break; }
  }
  const nextLabel = next ? describeStart(next, now) : undefined;

  if (running) {
    return {
      state: "on",
      current: running,
      next,
      label: `${running.shiftType} · ${running.startTime}–${running.endTime}`,
      nextLabel,
    };
  }
  const today = dayAt(0);
  if (today.isLeave) return { state: "leave", next, label: "Annual leave", nextLabel };
  if (!today.isWorking) return { state: "rest", next, label: "Rest day", nextLabel };
  return { state: "off", next, label: "Off now", nextLabel };
}

/**
 * The crewing board that matters now for a watch: the shift running, or —
 * between shifts on a working day — the next one (e.g. tonight's night
 * shift in the afternoon). A night shift keeps its start date until 08:00
 * next morning, matching how the board stores it. Null on rest days and
 * leave, or when the watch has no rota.
 */
export function crewingShiftFor(
  watch: string | undefined,
  now: Date = new Date()
): { shiftDate: string; shiftType: "1st Day" | "2nd Day" | "1st Night" | "2nd Night"; upcoming: boolean } | null {
  const s = watch ? getWatchShiftStatus(watch, now) : null;
  const shift = s?.current ?? (s?.state === "off" ? s.next : undefined);
  if (!shift) return null;
  return {
    shiftDate: shift.date,
    shiftType: shift.shiftType as "1st Day" | "2nd Day" | "1st Night" | "2nd Night",
    upcoming: !s?.current,
  };
}

/**
 * Two-part shift text for headers and status strips, from the watch's rota:
 *   on    → "2nd Night"    · "18:00–08:00"
 *   off   → "Off now"      · "2nd Night starts 18:00"
 *   rest  → "Rest day"     · "next 1st Day Thu 29 Oct 08:00"
 *   leave → "Annual leave" · "back 1st Day Mon 9 Mar 08:00"
 * Null when the watch has no rota (or no watch is set).
 */
export function shiftDisplay(watch: string | undefined, now: Date = new Date()): { main: string; sub: string } | null {
  const s = watch ? getWatchShiftStatus(watch, now) : null;
  if (!s) return null;
  if (s.state === "on" && s.current) {
    return { main: s.current.shiftType, sub: `${s.current.startTime}–${s.current.endTime}` };
  }
  const next = s.nextLabel ?? "";
  if (s.state === "off") return { main: s.label, sub: next };
  if (s.state === "leave") return { main: s.label, sub: next ? `back ${next}` : "" };
  return { main: s.label, sub: next ? `next ${next}` : "" };
}

/**
 * Returns the ISO date string (YYYY-MM-DD) of the next working shift for the
 * given watch, searching from today up to 14 days ahead.
 * Falls back to today's date if the watch has no rota configuration or no
 * working shift is found within the window.
 */
export function getNextShiftDate(watch?: string): string {
  const todayIso = new Date().toISOString().split("T")[0];
  if (!watch || !hasRotaConfig(watch)) return todayIso;

  const now  = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to   = new Date(from);
  to.setDate(to.getDate() + 14);

  const shifts = getShiftsForDateRange(watch, from, to);
  return shifts.find(s => s.isWorking)?.date ?? todayIso;
}

/**
 * The shift a watch is on now, or the last one it worked — what a handover is
 * written for. A night belongs to the day it started (as on the crewing board),
 * so a handover written at 07:45 on Tuesday is for Monday's night shift.
 */
export function handoverShiftFor(watch: string, now: Date = new Date()): { date: string; type: "Day" | "Night" } | null {
  if (!hasRotaConfig(watch)) return null;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const h = now.getHours();
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (h < 8 ? 1 : 0));
  let type: "Day" | "Night" = h >= 8 && h < 18 ? "Day" : "Night";
  for (let i = 0; i < 2 * 80; i++) {
    const s = getShiftForDate(watch, date)?.shiftType;
    if (type === "Day" ? s === "1st Day" || s === "2nd Day" : s === "1st Night" || s === "2nd Night") return { date: iso(date), type };
    if (type === "Night") type = "Day";
    else { type = "Night"; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1); }
  }
  return null;
}
