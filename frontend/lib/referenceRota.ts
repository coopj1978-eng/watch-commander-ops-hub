// The watch references rota (Appendix B, "10 year planner", City of Glasgow
// station standards — John, Nov 2026). Each watch holds one of five station
// references for two calendar years and is secondary on the next one: the
// secondary watch covers a reference when its main watch is off. Every two
// years (1 January) each watch moves on one reference; the ten-year cycle
// started in 2022 and repeats.

import { getShiftForDate } from "./shiftRota";

export const REFERENCE_START = 2022;
export const REFERENCE_YEARS = 2;
/** The planner's rows, top to bottom. */
export const REFERENCE_WATCHES = ["Green", "Blue", "White", "Red", "Amber"] as const;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Which two-year block a year falls in: 0 = 2022–2023 … 4 = 2030–2031, then round again. */
export function referencePeriod(year: number): number {
  return mod(Math.floor((year - REFERENCE_START) / REFERENCE_YEARS), 5);
}

/** "2026–2027" for any year in that block. */
export function periodLabel(year: number): string {
  const start = REFERENCE_START + Math.floor((year - REFERENCE_START) / REFERENCE_YEARS) * REFERENCE_YEARS;
  return `${start}–${start + REFERENCE_YEARS - 1}`;
}

/** The first year of the next block — when the references move on. */
export function nextChangeYear(year: number): number {
  return REFERENCE_START + (Math.floor((year - REFERENCE_START) / REFERENCE_YEARS) + 1) * REFERENCE_YEARS;
}

/** A watch's main and secondary reference (1–5) in a year, or null for an unknown watch. */
export function watchReferences(watch: string, year: number): { main: number; secondary: number } | null {
  const i = REFERENCE_WATCHES.findIndex((w) => w.toLowerCase() === watch.toLowerCase());
  if (i < 0) return null;
  const main = mod(i + referencePeriod(year), 5) + 1;
  return { main, secondary: (main % 5) + 1 };
}

/** Which watch holds a reference as main, and which as secondary, in a year. */
export function referenceHolders(ref: number, year: number): { main: string; secondary: string } {
  const p = referencePeriod(year);
  return {
    main: REFERENCE_WATCHES[mod(ref - 1 - p, 5)],
    secondary: REFERENCE_WATCHES[mod(ref - 2 - p, 5)],
  };
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The first day of the month / quarter / year a date falls in, and of the next one. */
function cardPeriod(cadence: string, date: Date): [Date, Date] {
  const y = date.getFullYear();
  if (cadence === "monthly") return [new Date(y, date.getMonth(), 1), new Date(y, date.getMonth() + 1, 1)];
  if (cadence === "quarterly") {
    const q = Math.floor(date.getMonth() / 3) * 3;
    return [new Date(y, q, 1), new Date(y, q + 3, 1)];
  }
  return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
}

/**
 * When a reference card next comes up — the same rule as the server's
 * lib/referenceRota.ts: the 1st Day of the holding watch's last tour of the
 * month, quarter or year (the secondary watch's only if the main watch has no
 * tour in it). This period's card while its tour is on or still to come,
 * otherwise the next period's.
 */
export function nextReferenceCard(ref: number, cadence: string, today: Date = new Date()): { watch: string; date: Date } | null {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let [start, end] = cardPeriod(cadence, day);
  for (let i = 0; i < 2; i++) {
    const { main, secondary } = referenceHolders(ref, start.getFullYear());
    for (const watch of [main, secondary]) {
      let last: Date | null = null;
      for (let d = start; d < end; d = addDays(d, 1)) if (getShiftForDate(watch, d)?.shiftType === "1st Day") last = d;
      if (!last) continue;
      if (addDays(last, 3) >= day) return { watch, date: last };
      break;
    }
    [start, end] = cardPeriod(cadence, end);
  }
  return null;
}
