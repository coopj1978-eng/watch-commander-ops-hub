import { describe, it, expect } from "vitest";
import { suggestCrew, topFor, type Candidate, type Seat } from "./autoCrew";

const seat = (appliance: "b10p1" | "b10p2", role: Seat["role"], label: string, required = true): Seat =>
  ({ key: `${appliance}-${label}`, appliance, role, required, label });

const P1: Seat[] = [seat("b10p1", "oic", "OIC"), seat("b10p1", "driver", "Driver"), seat("b10p1", "ba", "BA1"), seat("b10p1", "ba", "BA2"), seat("b10p1", "baeco", "BA EC")];
const P2: Seat[] = [seat("b10p2", "oic", "OIC"), seat("b10p2", "driver", "Driver"), seat("b10p2", "ba", "BA1"), seat("b10p2", "ba", "BA2"), seat("b10p2", "baeco", "BA EC", false)];

const p = (id: string, q: Partial<Candidate> = {}): Candidate =>
  ({ id, name: id, system_role: "FF", ba: true, driver_lgv: false, oic: false, ...q });

// A Blue-like watch: WC + CC with OIC, two LGV drivers, the rest BA.
const blue: Candidate[] = [
  p("Brian (WC)", { system_role: "WC", oic: true }),
  p("Colin (CC)", { system_role: "CC", oic: true }),
  p("John (WC)", { system_role: "WC", oic: true, driver_lgv: true }),
  p("Iain Lowson", { driver_lgv: true }),
  p("Chris"), p("Ewan"), p("Iain Wilson"), p("Andy", { ba: false }), p("Iain Lawson", { ba: false }),
];

describe("auto-crew", () => {
  it("never puts anyone in a seat they aren't qualified for", () => {
    const { picks } = suggestCrew([...P1, ...P2], blue);
    for (const { seat: s, member } of picks) {
      if (s.role === "oic") expect(member.oic).toBe(true);
      if (s.role === "driver") expect(member.driver_lgv).toBe(true);
      if (s.role === "ba" || s.role === "baeco") expect(member.ba).toBe(true);
    }
  });

  it("uses each person once", () => {
    const { picks } = suggestCrew([...P1, ...P2], blue);
    const ids = picks.map((x) => x.member.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts a WC in charge of the 1st pump and the CC on the 2nd", () => {
    const { picks } = suggestCrew([...P1, ...P2], blue);
    const oic = (a: string) => picks.find((x) => x.seat.appliance === a && x.seat.role === "oic")!.member;
    expect(oic("b10p1").system_role).toBe("WC");
    expect(oic("b10p2").system_role).toBe("CC");
  });

  it("doesn't spend an LGV driver on a BA seat while a Driver seat is open", () => {
    const { picks } = suggestCrew([...P1, ...P2], blue);
    const drivers = picks.filter((x) => x.seat.role === "driver").map((x) => x.member.id);
    expect(drivers).toHaveLength(2);
    expect(drivers).toContain("Iain Lowson");
  });

  it("reports seats nobody qualified is left for instead of filling them", () => {
    const thin = [p("Officer", { system_role: "CC", oic: true }), p("Driver", { driver_lgv: true, ba: false })];
    const { picks, unfilled } = suggestCrew(P1, thin);
    expect(picks.map((x) => x.seat.label).sort()).toEqual(["Driver", "OIC"]);
    expect(unfilled.map((s) => s.label)).toEqual(["BA1", "BA2", "BA EC"]);
  });

  it("required seats are filled before the optional one", () => {
    const four = [p("O", { oic: true, system_role: "CC" }), p("D", { driver_lgv: true }), p("B1"), p("B2")];
    const { unfilled } = suggestCrew(P2, four);
    expect(unfilled.map((s) => s.label)).toEqual(["BA EC"]);
  });

  it("suggests the best people for one seat", () => {
    expect(topFor(P1[0], blue).map((c) => c.system_role)).toEqual(["WC", "WC"]);
    expect(topFor(P2[0], blue)[0].system_role).toBe("CC");
  });
});
