// The Home "at a glance" tiles (Nov 2026): the sums behind the small charts.

export interface DayBar {
  /** YYYY-MM-DD */
  date: string;
  /** One-letter weekday, for under the bar. */
  letter: string;
  missed: number;
  today: boolean;
}

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Station checks missed on each of the last `days` days, oldest first, ending today. */
export function missedByDay(missed: { date: string }[], todayIso: string, days = 7): DayBar[] {
  const counts = new Map<string, number>();
  for (const m of missed) {
    const day = String(m.date).slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(todayIso, i - (days - 1));
    const [y, m, d] = date.split("-").map(Number);
    return {
      date,
      letter: LETTERS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
      missed: counts.get(date) ?? 0,
      today: date === todayIso,
    };
  });
}

/** Bar height as a share of the tallest day, never invisible: a clear day still shows a stub. */
export function barHeight(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0.14;
  return Math.max(0.28, value / max);
}

export interface BoardProgress {
  total: number;
  done: number;
  started: number;
  /** 0–1 */
  share: number;
}

/** How far through a shift's cards the watch is. */
export function boardProgress(tasks: { status: string }[]): BoardProgress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const started = tasks.filter((t) => t.status === "InProgress").length;
  return { total, done, started, share: total ? done / total : 0 };
}

/** First name and the initial of the surname: "Jordan H". */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0]}`;
}

// ── Coming shifts and the detachment rota (Nov 2026) ─────────────────────────
// The crew-available and shift-board tiles repeated what the shift panel and
// the cards under it already said, so they made way for two things Home
// didn't show: how the watch's next shifts are crewed, and who's next out.

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Thu 19" */
export function dayLabel(iso: string): string {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
}

/** The watch's next `n` shifts, soonest first, starting with the one dated `fromIso`. */
export function comingShifts<T extends { date: string }>(shifts: T[], fromIso: string, n = 4): T[] {
  const day = (s: T) => String(s.date).slice(0, 10);
  return shifts
    .filter((s) => day(s) >= fromIso)
    .sort((a, b) => (day(a) < day(b) ? -1 : day(a) > day(b) ? 1 : 0))
    .slice(0, n);
}

/** The shift to look at first: fewest pumps it can ride, then fewest people; the earliest on a tie. */
export function tightestShift<T extends { available: number; pumps: number }>(shifts: T[]): T | undefined {
  return shifts.reduce<T | undefined>(
    (worst, s) => (!worst || s.pumps < worst.pumps || (s.pumps === worst.pumps && s.available < worst.available) ? s : worst),
    undefined,
  );
}

/** "Andy J flexi, Jordan H sick +1" — who's away and why, two names at most. */
export function awayText(away: { name?: string; why: string }[]): string {
  const named = away.filter((a) => a.name);
  if (named.length === 0) return away.length ? `${away.length} away` : "";
  const shown = named.slice(0, 2).map((a) => `${shortName(a.name!)} ${a.why.toLowerCase()}`);
  const more = away.length - shown.length;
  return `${shown.join(", ")}${more > 0 ? ` +${more}` : ""}`;
}

/** Whole days from one date to another (YYYY-MM-DD), never negative. */
export function daysBetween(fromIso: string, toIso: string): number {
  const at = (iso: string) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.max(0, Math.round((at(toIso) - at(fromIso)) / 86_400_000));
}
