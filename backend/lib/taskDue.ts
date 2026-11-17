import { ukInstant, ukParts } from "./shiftRota";

// When a task counts as overdue (Nov 2026). A task made on the shift board is
// due on that shift's date, and a night shift runs to 08:00 the next morning —
// so nothing is overdue until 08:00 on the day after its due date. (It used to
// be "the moment the due time passes", which made a card created during a
// shift overdue at once: a red Tasks badge and an alert for a brand-new task.)

/** The instant a task due at `dueAt` becomes overdue: 08:00 UK time the next day. */
export function overdueFrom(dueAt: Date | string): Date {
  const { date } = ukParts(new Date(dueAt));
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return ukInstant(next, 8);
}

export function isOverdue(dueAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  return !!dueAt && now.getTime() >= overdueFrom(dueAt).getTime();
}

/** Whole days overdue, counting from the day after the due date (1 on the first morning). */
export function daysOverdue(dueAt: Date | string, now: Date = new Date()): number {
  return Math.max(1, Math.floor((now.getTime() - overdueFrom(dueAt).getTime()) / 86_400_000) + 1);
}

/** The same rule in SQL, for a timestamptz column or expression. */
export const overdueSql = (col: string) =>
  `(((${col} AT TIME ZONE 'Europe/London')::date + 1) + TIME '08:00') <= (NOW() AT TIME ZONE 'Europe/London')`;
