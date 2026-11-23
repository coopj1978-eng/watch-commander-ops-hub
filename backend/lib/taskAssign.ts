/**
 * Giving a task to someone (John, Nov 2026): a Watch or Crew Commander — or
 * the admin — can give a task to anyone at this station, on any watch.
 * Anyone can take a task themselves, or hand one back (nobody).
 * No Encore imports, so it can be unit-tested directly.
 */

/** Why this person can't give the task to `assignee`, or null when they can. */
export function assignRefusal(
  who: { userID: string; role: string; isAdmin?: boolean },
  assignee: string | null,
): string | null {
  if (!assignee || assignee === who.userID) return null;
  if (who.role === "WC" || who.role === "CC" || who.isAdmin) return null;
  return "Only a Watch or Crew Commander can give a task to someone else.";
}

/** The note the person gets: who gave it them and, if it has one, when it's due. */
export function assignedNote(task: { title: string; due_at?: Date | string | null }, byName: string | null): string {
  const due = task.due_at ? new Date(task.due_at) : null;
  const when = due && !Number.isNaN(due.getTime())
    ? `, due ${due.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" })}`
    : "";
  return `${byName?.trim() || "A commander"} gave you "${task.title}"${when}.`;
}
