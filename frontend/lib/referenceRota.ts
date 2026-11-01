// The watch references rota (Appendix B, "10 year planner", City of Glasgow
// station standards — John, Nov 2026). Each watch holds one of five station
// references for two calendar years and is secondary on the next one: the
// secondary watch covers a reference when its main watch is off. Every two
// years (1 January) each watch moves on one reference; the ten-year cycle
// started in 2022 and repeats.

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
