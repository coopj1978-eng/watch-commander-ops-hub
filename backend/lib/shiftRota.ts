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

type ShiftType = "1st Day" | "2nd Day" | "1st Night" | "2nd Night" | "Annual Leave" | "Rest";

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
  const hour = datetime.getHours();
  const isNight = hour >= 18 || hour < 8;

  // Night shifts after midnight belong to the previous day's shift
  const shiftDate = isNight && hour < 8
    ? new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate() - 1)
    : new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate());

  const targets: ShiftType[] = isNight
    ? ["1st Night", "2nd Night"]
    : ["1st Day",   "2nd Day"];

  for (const watch of WATCHES) {
    const refMonday = toDateOnly(REFERENCE_MONDAYS[watch]);
    const shift = computeShiftForDate(shiftDate, refMonday);
    if (targets.includes(shift)) return watch;
  }
  return null;
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
