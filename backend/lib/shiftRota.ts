/**
 * shiftRota.ts — 5WDS backend rota engine (ported from frontend lib)
 *
 * Pattern: 2 Day (08:00–18:00) → 2 Night (18:00–08:00) → 4 Rest → 18 Annual Leave
 * Mega-cycle = 70 days. Verified against SFRS 5WDS 2026 Calendar.
 */

const MEGA_CYCLE  = 70;
const LEAVE_START = 52;

const WATCHES = ["Amber", "Green", "Blue", "Red", "White"] as const;

const REFERENCE_MONDAYS: Record<string, string> = {
  Amber: "2026-02-09",
  Green: "2026-02-23",
  Blue:  "2026-03-09",
  Red:   "2026-03-23",
  White: "2026-04-06",
};

function diffDays(date: Date, base: Date): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((a - b) / 86_400_000);
}

function toDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export type ShiftType = "1st Day" | "2nd Day" | "1st Night" | "2nd Night" | "Annual Leave" | "Rest";

function computeShiftForDate(date: Date, refMonday: Date): ShiftType {
  const diff = diffDays(date, refMonday);
  const pos  = ((diff % MEGA_CYCLE) + MEGA_CYCLE) % MEGA_CYCLE;

  if (pos >= LEAVE_START) return "Annual Leave";

  const inRepeat = pos % 8;
  if (inRepeat === 0) return "1st Day";
  if (inRepeat === 1) return "2nd Day";
  if (inRepeat === 2) return "1st Night";
  if (inRepeat === 3) return "2nd Night";
  return "Rest";
}

/**
 * Given a datetime, returns which watch is on shift at that moment.
 *
 * Day shift  : 08:00–17:59 → looks up 1st Day / 2nd Day on that calendar date
 * Night shift: 18:00–07:59 → looks up 1st Night / 2nd Night
 *   - If hour < 8 the shift started the *previous* calendar day
 *
 * Returns null if no watch matches (e.g. all on rest/leave).
 */
export function getWatchOnShift(datetime: Date): string | null {
  // UK wall-clock time — the server runs in UTC, which is an hour out in BST.
  return watchForSlot(slotAt(datetime))?.watch ?? null;
}

/**
 * For an all-day event, returns which watch has the Day shift on that date.
 * Falls back to Night shift if no Day shift watch found.
 */
export function getWatchOnShiftForDate(date: Date): string | null {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (const watch of WATCHES) {
    const refMonday = toDateOnly(REFERENCE_MONDAYS[watch]);
    const shift = computeShiftForDate(d, refMonday);
    if (shift === "1st Day" || shift === "2nd Day") return watch;
  }
  // Fallback: night shift watch on that date
  for (const watch of WATCHES) {
    const refMonday = toDateOnly(REFERENCE_MONDAYS[watch]);
    const shift = computeShiftForDate(d, refMonday);
    if (shift === "1st Night" || shift === "2nd Night") return watch;
  }
  return null;
}

// ─── UK time + shift slots (shift board, Oct 2026) ───────────────────────────

/** UK wall-clock date (YYYY-MM-DD) and hour for an instant. */
export function ukParts(now: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** The instant of a UK wall-clock hour on a date — right in GMT and BST. */
export function ukInstant(dateIso: string, hour: number): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour));
  const shown = ukParts(guess);
  const shownAsUtc = Date.UTC(+shown.date.slice(0, 4), +shown.date.slice(5, 7) - 1, +shown.date.slice(8, 10), shown.hour);
  return new Date(guess.getTime() - (shownAsUtc - guess.getTime()));
}

export function addDaysIso(dateIso: string, n: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export type SlotType = "day" | "night";
export interface ShiftSlot { date: string; type: SlotType; start: Date; end: Date }

/** The day (08–18) or night (18–08 next day) shift starting on a date, in UK time. */
export function shiftSlot(date: string, type: SlotType): ShiftSlot {
  return type === "day"
    ? { date, type, start: ukInstant(date, 8), end: ukInstant(date, 18) }
    : { date, type, start: ukInstant(date, 18), end: ukInstant(addDaysIso(date, 1), 8) };
}

/** The shift running at `now`: day 08:00–18:00, or night 18:00–08:00 (dated the day it started). */
export function slotAt(now: Date = new Date()): ShiftSlot {
  const { date, hour } = ukParts(now);
  if (hour >= 8 && hour < 18) return shiftSlot(date, "day");
  return shiftSlot(hour < 8 ? addDaysIso(date, -1) : date, "night");
}

/** A watch's rota entry for a date ("1st Day", "Rest"…), or null for an unknown watch. */
export function watchShiftOn(watch: string, dateIso: string): ShiftType | null {
  const key = Object.keys(REFERENCE_MONDAYS).find((w) => w.toLowerCase() === watch.toLowerCase());
  if (!key) return null;
  return computeShiftForDate(toDateOnly(dateIso), toDateOnly(REFERENCE_MONDAYS[key]));
}

const works = (s: ShiftType | null, type: SlotType) =>
  type === "day" ? s === "1st Day" || s === "2nd Day" : s === "1st Night" || s === "2nd Night";

/** The watch working a slot, with its rota label ("2nd Night"). */
export function watchForSlot(slot: ShiftSlot): { watch: string; label: ShiftType } | null {
  for (const watch of WATCHES) {
    const s = watchShiftOn(watch, slot.date);
    if (works(s, slot.type)) return { watch, label: s! };
  }
  return null;
}

/** The slot a watch is working now, or its next one (past rest days and leave). */
export function slotForWatch(watch: string, now: Date = new Date()): (ShiftSlot & { label: ShiftType; onDuty: boolean }) | null {
  let { date, type } = slotAt(now);
  for (let i = 0; i < 2 * (MEGA_CYCLE + 2); i++) {
    const s = watchShiftOn(watch, date);
    if (works(s, type)) return { ...shiftSlot(date, type), label: s!, onDuty: i === 0 };
    if (type === "day") type = "night";
    else { type = "day"; date = addDaysIso(date, 1); }
  }
  return null;
}

/** The shift straight after this one (day → that night; night → next day). */
export function slotAfter(slot: ShiftSlot): ShiftSlot {
  return slot.type === "day" ? shiftSlot(slot.date, "night") : shiftSlot(addDaysIso(slot.date, 1), "day");
}
