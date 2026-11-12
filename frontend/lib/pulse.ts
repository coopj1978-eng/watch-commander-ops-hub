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
