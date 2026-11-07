// Can the people on a shift fill the pumps' seats? (Nov 2026, John: the
// riding count should look at skills, not just heads.) The seats are the
// crewing board's required ones (frontend/components/CrewingBoard.tsx):
//   B10P1 — OIC, Driver, BA, BA, BA Entry Control
//   B10P2 — OIC, Driver, BA, BA
// OIC = the OIC tick or a Watch/Crew Commander; Driver = LGV; BA and Entry
// Control = BA (frontend/lib/autoCrew.ts qualifiesFor). One seat each.

export interface RiderQuals { oic: boolean; driver: boolean; ba: boolean }
export type SeatRole = "OIC" | "Driver" | "BA" | "BA Entry Control";
export interface Seat { pump: "B10P1" | "B10P2"; role: SeatRole }

export const NO_QUALS: RiderQuals = { oic: false, driver: false, ba: false };

/** A person's crewing skills from their profile ticks, role and rank. */
export function riderQuals(p: { role?: string | null; rank?: string | null; oic?: boolean | null; driver_lgv?: boolean | null; ba?: boolean | null }): RiderQuals {
  const officer = /\b(wc|cc)\b|watch commander|crew commander/i.test(`${p.role ?? ""} ${p.rank ?? ""}`);
  return { oic: !!p.oic || officer, driver: !!p.driver_lgv, ba: !!p.ba };
}

const seat = (pump: Seat["pump"], role: SeatRole): Seat => ({ pump, role });
// Scarce seats first, so when there's a choice the seat left empty is a BA one.
const ONE_PUMP: Seat[] = [seat("B10P1", "OIC"), seat("B10P1", "Driver"), seat("B10P1", "BA"), seat("B10P1", "BA"), seat("B10P1", "BA Entry Control")];
const BOTH_PUMPS: Seat[] = [
  seat("B10P1", "OIC"), seat("B10P2", "OIC"), seat("B10P1", "Driver"), seat("B10P2", "Driver"),
  seat("B10P1", "BA"), seat("B10P1", "BA"), seat("B10P1", "BA Entry Control"), seat("B10P2", "BA"), seat("B10P2", "BA"),
];

const fits = (q: RiderQuals, role: SeatRole) => (role === "OIC" ? q.oic : role === "Driver" ? q.driver : q.ba);

/**
 * The seats nobody can fill, after the best possible assignment (a maximum
 * matching: someone already seated moves over if that frees a seat they
 * alone could take).
 */
function emptySeats(seats: Seat[], people: RiderQuals[]): Seat[] {
  const seatOf = new Array<number>(people.length).fill(-1);
  const place = (s: number, tried: boolean[]): boolean => {
    for (let p = 0; p < people.length; p++) {
      if (tried[p] || !fits(people[p], seats[s].role)) continue;
      tried[p] = true;
      if (seatOf[p] < 0 || place(seatOf[p], tried)) {
        seatOf[p] = s;
        return true;
      }
    }
    return false;
  };
  return seats.filter((_, s) => !place(s, new Array<boolean>(people.length).fill(false)));
}

export interface SeatCheck {
  /** Pumps that can ride with qualified crew: 2, 1 (B10P1 only) or 0. */
  pumps: 0 | 1 | 2;
  /** The seats short: for both pumps when one can ride, for B10P1 when none can. */
  short: Seat[];
}

export function seatCheck(people: RiderQuals[]): SeatCheck {
  const both = emptySeats(BOTH_PUMPS, people);
  if (both.length === 0) return { pumps: 2, short: [] };
  const one = emptySeats(ONE_PUMP, people);
  return one.length === 0 ? { pumps: 1, short: both } : { pumps: 0, short: one };
}

/** "1 Driver and 2 BA" — what the empty seats need. */
export function describeShort(short: Seat[]): string {
  const counts = new Map<string, number>();
  for (const s of short) {
    const need = s.role === "BA Entry Control" ? "BA" : s.role;
    counts.set(need, (counts.get(need) ?? 0) + 1);
  }
  const parts = (["OIC", "Driver", "BA"] as const)
    .filter((r) => counts.has(r))
    .map((r) => `${counts.get(r)} ${r === "Driver" ? (counts.get(r) === 1 ? "driver" : "drivers") : r}`);
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
