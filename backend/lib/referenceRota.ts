/**
 * The watch references rota on the server (Appendix B of the City of Glasgow
 * station standards — John, Nov 2026); the same rule as
 * frontend/lib/referenceRota.ts. Each watch holds a main reference for two
 * calendar years and is secondary on the next one (covering it when the main
 * watch is off); the ten-year cycle started in 2022.
 */

import { addDaysIso, ukInstant, watchShiftOn } from "./shiftRota";

export const REFERENCE_START = 2022;
const WATCHES = ["Green", "Blue", "White", "Red", "Amber"] as const;
const mod = (n: number, m: number) => ((n % m) + m) % m;

export function referencePeriod(year: number): number {
  return mod(Math.floor((year - REFERENCE_START) / 2), 5);
}

/** Which watch holds a reference as main, and which as secondary, in a year. */
export function referenceHolders(ref: number, year: number): { main: string; secondary: string } {
  const p = referencePeriod(year);
  return { main: WATCHES[mod(ref - 1 - p, 5)], secondary: WATCHES[mod(ref - 2 - p, 5)] };
}

export type ReferenceCadence = "monthly" | "quarterly" | "annual";
export const REFERENCE_CADENCES: ReferenceCadence[] = ["monthly", "quarterly", "annual"];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The period a reference card covers on a date: monthly — that month;
 * quarterly — Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec; annual — the year.
 * `start` keys the card (one per period); `endDate` is the first day after it.
 */
export function referenceCardPeriod(cadence: string, dateIso: string): { start: string; endDate: string } | null {
  const [y, m] = dateIso.split("-").map(Number);
  if (cadence === "monthly") {
    return { start: `${y}-${pad(m)}-01`, endDate: m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01` };
  }
  if (cadence === "quarterly") {
    const q = Math.floor((m - 1) / 3) * 3 + 1;
    return { start: `${y}-${pad(q)}-01`, endDate: q === 10 ? `${y + 1}-01-01` : `${y}-${pad(q + 3)}-01` };
  }
  if (cadence === "annual") return { start: `${y}-01-01`, endDate: `${y + 1}-01-01` };
  return null;
}

/** The 1st Day of a watch's last tour (1st Day → 2nd Night) that starts in a period, or null. */
export function lastTourStart(watch: string, period: { start: string; endDate: string }): string | null {
  let last: string | null = null;
  for (let d = period.start; d < period.endDate; d = addDaysIso(d, 1)) {
    if (watchShiftOn(watch, d) === "1st Day") last = d;
  }
  return last;
}

export interface ReferenceCardPlan {
  period: { start: string; endDate: string };
  watch: string;
  /** The 1st Day of the tour the card comes up on. */
  tourStart: string;
  /** The end of that tour's 2nd Night. */
  due: Date;
}

/**
 * When and for whom a reference card comes up (John, Nov 2026): on the 1st
 * Day of the main watch's last tour of the month, quarter or year, due by
 * the end of that tour's 2nd Night (a tour starting on the last days of the
 * period runs over into the next one). The secondary watch only takes it if
 * the main watch has no tour in the period at all.
 */
export function referenceCardPlan(ref: number, cadence: string, dateIso: string): ReferenceCardPlan | null {
  const period = referenceCardPeriod(cadence, dateIso);
  if (!period) return null;
  const { main, secondary } = referenceHolders(ref, Number(period.start.slice(0, 4)));
  for (const watch of [main, secondary]) {
    const tourStart = lastTourStart(watch, period);
    if (tourStart) return { period, watch, tourStart, due: ukInstant(addDaysIso(tourStart, 4), 8) };
  }
  return null;
}
