// SFRS financial-year quarters (Q1 = Apr–Jun … Q4 = Jan–Mar) and target pace.
// One place for the Targets page's quarter strip, cards and pace lines.

import { getShiftsForDateRange } from "./shiftRota";

export type QuarterNo = 1 | 2 | 3 | 4;

export interface FyQuarter {
  fy: number;          // April-start financial year, e.g. 2026 = 2026/27
  q: QuarterNo;
  start: Date;         // local midnight, first day
  end: Date;           // local midnight, last day
  months: string;      // "Oct–Dec"
  label: string;       // "Q3 2026/27"
}

const MONTHS = ["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"];

export const fyLabel = (fy: number) => `${fy}/${String(fy + 1).slice(2)}`;

export function fyQuarter(fy: number, q: QuarterNo): FyQuarter {
  const startMonth = [3, 6, 9, 0][q - 1];
  const year = q === 4 ? fy + 1 : fy;
  return {
    fy,
    q,
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 0),
    months: MONTHS[q - 1],
    label: `Q${q} ${fyLabel(fy)}`,
  };
}

export function currentFyQuarter(now: Date = new Date()): FyQuarter {
  const m = now.getMonth();
  const fy = m >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const q = (m >= 3 ? Math.floor((m - 3) / 3) + 1 : 4) as QuarterNo;
  return fyQuarter(fy, q);
}

const DAY = 86_400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** How far through the quarter we are: 0 before it starts, 1 once it's over. */
export function quarterTime(fq: FyQuarter, now: Date = new Date()) {
  const today = midnight(now);
  const totalDays = Math.round((fq.end.getTime() - fq.start.getTime()) / DAY) + 1;
  if (today < fq.start) return { phase: "future" as const, elapsed: 0, dayOf: 0, totalDays, daysLeft: totalDays };
  if (today > fq.end) return { phase: "past" as const, elapsed: 1, dayOf: totalDays, totalDays, daysLeft: 0 };
  const dayOf = Math.round((today.getTime() - fq.start.getTime()) / DAY) + 1;
  return { phase: "now" as const, elapsed: dayOf / totalDays, dayOf, totalDays, daysLeft: totalDays - dayOf + 1 };
}

/** The watch's rostered shifts from today (inclusive) to the end of the quarter. */
export function shiftsLeft(watch: string, fq: FyQuarter, now: Date = new Date()): number | null {
  if (!watch) return null;
  const from = midnight(now) > fq.start ? midnight(now) : fq.start;
  if (from > fq.end) return 0;
  const days = getShiftsForDateRange(watch, from, fq.end);
  if (days.length === 0 && !getShiftsForDateRange(watch, fq.start, fq.end).length) return null; // no rota
  return days.filter((d) => d.isWorking).length;
}

export type PaceState = "done" | "ahead" | "on" | "behind" | "late" | "missed" | "upcoming" | "none";

export interface Pace {
  state: PaceState;
  /** Where the count should be by today if spread evenly over the quarter. */
  expected: number;
  /** How many short of `expected` (0 when on pace). */
  behindBy: number;
  remaining: number;
}

/**
 * Pace against an even spread over the quarter. "late" = behind with less than
 * a quarter of the time left; "missed" = the quarter is over and the target
 * wasn't reached. `extraMet` lets community's TAP minimum hold back "done".
 */
export function pace(actual: number, target: number, elapsed: number, phase: "future" | "now" | "past", extraMet = true): Pace {
  const remaining = Math.max(0, target - actual);
  if (target <= 0) return { state: "none", expected: 0, behindBy: 0, remaining: 0 };
  if (actual >= target && extraMet) return { state: "done", expected: target, behindBy: 0, remaining: 0 };
  if (phase === "future") return { state: "upcoming", expected: 0, behindBy: 0, remaining };
  if (phase === "past") return { state: "missed", expected: target, behindBy: remaining, remaining };
  const expected = Math.floor(target * elapsed);
  const behindBy = Math.max(0, expected - actual);
  if (behindBy === 0) return { state: actual > expected ? "ahead" : "on", expected, behindBy, remaining };
  return { state: elapsed > 0.75 ? "late" : "behind", expected, behindBy, remaining };
}

export const PACE_LABEL: Record<PaceState, string> = {
  done: "Done",
  ahead: "Ahead",
  on: "On pace",
  behind: "Behind",
  late: "Behind",
  missed: "Missed",
  upcoming: "Not started",
  none: "No target",
};
