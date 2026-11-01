/**
 * Springburn's hydrant route rota (the "Hydrant Routes" sheet on the station
 * board, John Nov 2026). The station's hydrants are split into 40 SP routes
 * (some in A/B halves), grouped into 15 route groups. Each calendar year every
 * watch does one group; Year 1 was 2019 and the 15-year cycle repeats (2034 is
 * Year 1 again). Years run in blocks of three — each block covers all 15 groups
 * across the 5 watches — and every block moves each watch along one place.
 */

export const HYDRANT_CYCLE_START = 2019;
export const HYDRANT_CYCLE_YEARS = 15;

/** The columns of the rota sheet, left to right. */
export const HYDRANT_WATCHES = ["Green", "Blue", "White", "Red", "Amber"] as const;

/** The 15 route groups as [first route, last route], in sheet order (Year 1–3 rows). */
export const HYDRANT_GROUPS: [string, string][] = [
  ["1", "3"], ["4", "7"], ["8", "11"], ["12", "16"], ["17", "21"],
  ["22", "23B"], ["24A", "25A"], ["25B", "26B"], ["27", "28B"], ["29", "30B"],
  ["31A", "31B"], ["32A", "32B"], ["33", "35"], ["36", "38"], ["39", "40"],
];

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** 1–15: where a calendar year sits in the cycle (2026 → 8). */
export function cycleYear(year: number): number {
  return mod(year - HYDRANT_CYCLE_START, HYDRANT_CYCLE_YEARS) + 1;
}

/** The route group (0–14) a watch does in a year, or null for an unknown watch. */
export function groupFor(watch: string, year: number): number | null {
  const i = HYDRANT_WATCHES.findIndex((w) => w.toLowerCase() === watch.toLowerCase());
  if (i < 0) return null;
  const y = cycleYear(year) - 1;
  const block = Math.floor(y / 3);
  const row = y % 3;
  return row * 5 + mod(i - block, 5);
}

/** The watch doing a route group in a year, or null if the group isn't on that year's row. */
export function watchForGroup(group: number, year: number): string | null {
  const y = cycleYear(year) - 1;
  if (Math.floor(group / 5) !== y % 3) return null;
  return HYDRANT_WATCHES[mod((group % 5) + Math.floor(y / 3), 5)];
}

/** "SP 27 – 28B" */
export function groupLabel(group: number): string {
  const [a, b] = HYDRANT_GROUPS[group];
  return `SP ${a} – ${b}`;
}

/** "28B" → [28, "B"]; "3A+AA" → [3, "A+AA"]. */
export function routeKey(route: string): [number, string] {
  const m = /^(\d+)(.*)$/.exec(route.trim().toUpperCase());
  return m ? [Number(m[1]), m[2]] : [Number.MAX_SAFE_INTEGER, route];
}

export function compareRoutes(a: string, b: string): number {
  const [an, as] = routeKey(a);
  const [bn, bs] = routeKey(b);
  return an - bn || as.localeCompare(bs);
}

/** Whether a route falls in a group's range. A bare number takes in all its halves ("23B" ends after 23A and 23B). */
export function routeInGroup(route: string, group: number): boolean {
  const [n, s] = routeKey(route);
  const [sn, ss] = routeKey(HYDRANT_GROUPS[group][0]);
  const [en, es] = routeKey(HYDRANT_GROUPS[group][1]);
  const fromStart = n > sn || (n === sn && (ss === "" || s >= ss));
  const toEnd = n < en || (n === en && (es === "" || s.slice(0, es.length) <= es));
  return fromStart && toEnd;
}

/** The group a route belongs to, or null. */
export function groupOfRoute(route: string): number | null {
  const g = HYDRANT_GROUPS.findIndex((_, i) => routeInGroup(route, i));
  return g < 0 ? null : g;
}

/** Which watch has a route in a year. */
export function watchForRoute(route: string, year: number): string | null {
  const g = groupOfRoute(route);
  return g === null ? null : watchForGroup(g, year);
}

/** What a hydrant's codes say: 1 and 6 are fine, 2–5 couldn't be inspected, 7–13 are defects. */
export const UNABLE_CODES = [2, 3, 4, 5];
export const DEFECT_CODES = [7, 8, 9, 10, 11, 12, 13];
export const INSPECTION_CODE_MAX = 13;
export const ACTION_CODE_MAX = 9;

/** The current calendar year in the UK. */
export function ukYear(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric" }).format(now));
}
