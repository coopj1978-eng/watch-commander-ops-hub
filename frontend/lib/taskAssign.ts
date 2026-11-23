import { HOME_STATION } from "@/lib/constants";

// Giving a task to someone (John, Nov 2026): anyone at this station, on any
// watch. Mirrors the server's rule (backend/lib/station.ts): a record with no
// station counts as here; an admin-only account (rank "Admin") isn't crew.

const WATCH_ORDER = ["Green", "Red", "White", "Blue", "Amber"];

export interface AssignablePerson {
  id: string;
  name: string;
  rank?: string;
  watch: string;
}

interface PersonRow {
  user: { id: string; name?: string; email?: string; watch_unit?: string; left_at?: string | Date | null };
  profile?: { station?: string | null; rank?: string | null; watch?: string | null } | null;
}

/** The station's people, grouped by watch — your own watch first, then the rota order. */
export function stationPeople(rows: PersonRow[], myWatch?: string | null): { watch: string; people: AssignablePerson[] }[] {
  const groups = new Map<string, AssignablePerson[]>();
  for (const { user, profile } of rows) {
    if (user.left_at) continue;
    const station = (profile?.station ?? "").trim();
    if (station && station !== HOME_STATION) continue;
    if ((profile?.rank ?? "").trim() === "Admin") continue;
    const raw = (user.watch_unit || profile?.watch || "").trim();
    const watch = raw ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : "";
    const person = { id: user.id, name: user.name || user.email?.split("@")[0] || "Unknown", rank: profile?.rank ?? undefined, watch };
    groups.set(watch, [...(groups.get(watch) ?? []), person]);
  }
  const mine = (myWatch ?? "").toLowerCase();
  const rank = (w: string) => (w && w.toLowerCase() === mine ? -1 : w ? (WATCH_ORDER.indexOf(w) + 1 || 50) : 99);
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([watch, people]) => ({ watch, people: people.sort((a, b) => a.name.localeCompare(b.name)) }));
}
