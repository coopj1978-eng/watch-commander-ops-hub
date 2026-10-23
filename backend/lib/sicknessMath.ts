const DAY_MS = 86_400_000;

export type TriggerStage = "None" | "Stage1" | "Stage2" | "Stage3";

/** Today's date (YYYY-MM-DD) in UK time — the service operates on UK days, not UTC days. */
export function ukTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toIsoDate(v: Date | string): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

function isoToDay(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
}

export interface SicknessRow {
  start_date: Date | string;
  end_date: Date | string;
  returned_to_work_at: Date | string | null;
}

/**
 * Rolling sickness totals for one person over the last six months.
 * An open sickness (not booked back fit) counts up to today. Overlapping
 * rows — e.g. a duplicate booking — are merged so they count once.
 */
export function rollingSickness(rows: SicknessRow[], todayIso = ukTodayIso()) {
  const today = isoToDay(todayIso);
  const windowStartDate = new Date(todayIso + "T00:00:00.000Z");
  windowStartDate.setUTCMonth(windowStartDate.getUTCMonth() - 6);
  const windowStart = windowStartDate.getTime() / DAY_MS;

  const intervals = rows
    .map((r) => {
      const start = isoToDay(toIsoDate(r.start_date));
      const end = r.returned_to_work_at === null ? today : isoToDay(toIsoDate(r.end_date));
      return { start, end: Math.min(Math.max(end, start), today) };
    })
    .filter((i) => i.start <= today && i.end >= windowStart)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const i of intervals) {
    const last = merged[merged.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else merged.push({ ...i });
  }

  let days = 0;
  for (const m of merged) days += m.end - Math.max(m.start, windowStart) + 1;
  return { episodes: merged.length, days };
}
