/**
 * The watch references rota on the server (Appendix B of the City of Glasgow
 * station standards — John, Nov 2026); the same rule as
 * frontend/lib/referenceRota.ts. Each watch holds a main reference for two
 * calendar years and is secondary on the next one (covering it when the main
 * watch is off); the ten-year cycle started in 2022.
 */

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
 * quarterly — Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec; annual — from its month to
 * the end of the year (null before that month). `start` keys the card (one
 * per period); `endDate` is the first day after it, when it's due.
 */
export function referenceCardPeriod(
  cadence: string, month: number | null | undefined, dateIso: string,
): { start: string; endDate: string } | null {
  const [y, m] = dateIso.split("-").map(Number);
  if (cadence === "monthly") {
    return { start: `${y}-${pad(m)}-01`, endDate: m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01` };
  }
  if (cadence === "quarterly") {
    const q = Math.floor((m - 1) / 3) * 3 + 1;
    return { start: `${y}-${pad(q)}-01`, endDate: q === 10 ? `${y + 1}-01-01` : `${y}-${pad(q + 3)}-01` };
  }
  if (cadence === "annual") {
    const from = Math.min(12, Math.max(1, month ?? 1));
    return m >= from ? { start: `${y}-${pad(from)}-01`, endDate: `${y + 1}-01-01` } : null;
  }
  return null;
}

/**
 * Who a reference card goes to when it comes round: the main watch on its
 * first shift in the period — or, if the main watch is on annual leave, the
 * secondary watch on theirs (John: the secondary covers it when the main
 * watch is off). Null while neither applies to the watch on duty.
 */
export function referenceCardOwner(
  ref: number, year: number, onDuty: string | null, mainOnLeave: boolean,
): string | null {
  if (!onDuty) return null;
  const { main, secondary } = referenceHolders(ref, year);
  if (onDuty.toLowerCase() === main.toLowerCase()) return main;
  if (mainOnLeave && onDuty.toLowerCase() === secondary.toLowerCase()) return secondary;
  return null;
}
