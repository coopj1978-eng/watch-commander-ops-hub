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
