// When a task counts as overdue (Nov 2026) — the same rule as the server's
// lib/taskDue.ts. A task made on the shift board is due on that shift's date,
// and a night shift runs to 08:00 the next morning, so nothing is overdue
// until 08:00 on the day after its due date. (A card created after midnight
// on a night shift used to show "Overdue 1d" straight away.)

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Days from today to the due date: 0 = due today, 2 = in two days, -3 = three
 * days overdue. Before 08:00, yesterday's date still counts as today — its
 * night shift is still running.
 */
export function dueDayDiff(due: Date, now: Date = new Date()): number {
  const diff = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000);
  return diff === -1 && now.getHours() < 8 ? 0 : diff;
}

export function isTaskOverdue(due: Date | string | null | undefined, now: Date = new Date()): boolean {
  return !!due && dueDayDiff(new Date(due), now) < 0;
}
