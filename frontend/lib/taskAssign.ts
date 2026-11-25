// Who a task can be given to (John, 25 Nov 2026): everyone still at the
// station, the task's own watch first — those are the people you'd normally
// hand it to — then the rest, each marked with their watch.

export interface AssignPerson {
  user: { id: string; name?: string | null; email?: string | null; watch_unit?: string | null; left_at?: string | Date | null };
  profile?: { watch?: string | null; rank?: string | null } | null;
}

export interface Assignee {
  id: string;
  name: string;
  /** "Red Watch" for someone on another watch; "" for the task's own. */
  note: string;
}

export function assigneeList(people: AssignPerson[], watch: string): Assignee[] {
  const mine = watch.trim().toLowerCase();
  const rows = people
    // Not someone who has left, and not the admin-only account (it isn't on a watch).
    .filter((p) => !p.user.left_at && p.profile?.rank !== "Admin")
    .map((p) => {
      const w = (p.user.watch_unit || p.profile?.watch || "").trim();
      return {
        id: p.user.id,
        name: p.user.name || p.user.email?.split("@")[0] || "Unknown",
        watch: w,
        own: !!mine && w.toLowerCase() === mine,
      };
    });
  rows.sort((a, b) => Number(b.own) - Number(a.own) || a.watch.localeCompare(b.watch) || a.name.localeCompare(b.name));
  return rows.map((r) => ({ id: r.id, name: r.name, note: r.own ? "" : r.watch ? `${r.watch} Watch` : "no watch" }));
}
