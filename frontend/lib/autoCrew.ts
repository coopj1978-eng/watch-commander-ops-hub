// Auto-crew: propose who rides in each empty seat on the crewing board.
//
// Fills seats with qualified, available people only — OIC needs OIC, Driver
// needs LGV, BA and BA Entry Control need BA. Scarce seats go first (OIC,
// then Driver, then BA), required before optional, 1st pump before 2nd, and
// each seat takes the person whose other qualifications are least needed
// elsewhere — so a WC or an LGV driver isn't spent on a BA seat while an OIC
// or Driver seat is still open. Officers lead: the 1st pump's OIC prefers a
// WC, then a CC. A seat nobody qualified is left for can't be filled — it's
// reported, never filled with someone unqualified.

export type SeatRole = "oic" | "driver" | "ba" | "baeco";

export interface Seat {
  key: string;
  appliance: "b10p1" | "b10p2";
  role: SeatRole;
  required: boolean;
  label: string;
}

export interface Candidate {
  id: string;
  name: string;
  system_role?: string;
  rank?: string;
  ba: boolean;
  driver_lgv: boolean;
  oic: boolean;
}

export function qualifiesFor(c: Candidate, role: SeatRole): boolean {
  return role === "oic" ? c.oic : role === "driver" ? c.driver_lgv : c.ba;
}

function officerLevel(c: Candidate): number {
  const r = `${c.system_role ?? ""} ${c.rank ?? ""}`.toLowerCase();
  if (/\bwc\b|watch commander/.test(r)) return 0;
  if (/\bcc\b|crew commander/.test(r)) return 1;
  return 2;
}

const ROLE_ORDER: Record<SeatRole, number> = { oic: 0, driver: 1, ba: 2, baeco: 3 };

/** Lower = better person for this seat. */
export function seatCost(c: Candidate, seat: Seat): number {
  if (seat.role === "oic") {
    // 1st pump: WC, then CC; 2nd pump: CC first (the WC usually rides the 1st).
    const lvl = officerLevel(c);
    const pref = seat.appliance === "b10p1" ? lvl : lvl === 1 ? 0 : lvl === 0 ? 1 : 2;
    return pref * 10 + (c.driver_lgv ? 1 : 0);
  }
  // Keep officers and spare qualifications for the seats that need them.
  let cost = 0;
  if (c.oic) cost += 4;
  if (officerLevel(c) < 2) cost += 4;
  if (seat.role !== "driver" && c.driver_lgv) cost += 2;
  if (seat.role === "driver" && !c.ba) cost -= 1; // a non-BA driver frees a BA wearer
  return cost;
}

export interface CrewPlan {
  picks: { seat: Seat; member: Candidate }[];
  unfilled: Seat[];
}

export function suggestCrew(seats: Seat[], candidates: Candidate[]): CrewPlan {
  const order = [...seats].sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      a.appliance.localeCompare(b.appliance),
  );
  const used = new Set<string>();
  const picks: CrewPlan["picks"] = [];
  const unfilled: Seat[] = [];
  for (const seat of order) {
    const best = candidates
      .filter((c) => !used.has(c.id) && qualifiesFor(c, seat.role))
      .sort((a, b) => seatCost(a, seat) - seatCost(b, seat) || a.name.localeCompare(b.name))[0];
    if (best) {
      used.add(best.id);
      picks.push({ seat, member: best });
    } else {
      unfilled.push(seat);
    }
  }
  return { picks, unfilled };
}

/** The best few people for one seat, for one-tap suggestions. */
export function topFor(seat: Seat, candidates: Candidate[], n = 2): Candidate[] {
  return candidates
    .filter((c) => qualifiesFor(c, seat.role))
    .sort((a, b) => seatCost(a, seat) - seatCost(b, seat) || a.name.localeCompare(b.name))
    .slice(0, n);
}
