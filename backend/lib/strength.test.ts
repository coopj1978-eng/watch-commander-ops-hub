import { describe, it, expect } from "vitest";
import { shiftStrength, type StrengthAdjustment } from "./strength";

const roster = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
const adj = (o: Partial<StrengthAdjustment>): StrengthAdjustment => ({
  user_id: "a", user_name: "A", type: "flexi", start: "2026-11-10", end: "2026-11-10", day_night: null,
  watch_unit: "Blue", covering_watch: null, covering_user_id: null, covering_name: null, ...o,
});
const run = (o: Partial<Parameters<typeof shiftStrength>[0]>) =>
  shiftStrength({ watch: "Blue", date: "2026-11-10", dayNight: "Day", roster, absences: [], adjustments: [], ...o });

describe("riding strength", () => {
  it("everyone available with nothing booked", () => {
    expect(run({})).toMatchObject({ total: 4, available: 4, away: [], covers: [] });
  });

  it("an open sickness counts until booked back fit", () => {
    const sick = { person: "a", type: "sickness", start: "2026-11-01", end: "2026-11-03", back: null };
    expect(run({ absences: [sick] }).away).toEqual([{ id: "a", name: "A", why: "Sick" }]);
    // Back fit sets end_date to the day before the return.
    expect(run({ absences: [{ ...sick, end: "2026-11-09", back: "2026-11-10" }] }).available).toBe(4);
    expect(run({ absences: [{ ...sick, end: "2026-11-10", back: "2026-11-11" }] }).available).toBe(3);
  });

  it("leave runs its dates only", () => {
    const al = { person: "b", type: "AL", start: "2026-11-08", end: "2026-11-09", back: null };
    expect(run({ absences: [al] }).available).toBe(4);
    expect(run({ absences: [{ ...al, end: "2026-11-10" }] }).away[0].why).toBe("Leave");
  });

  it("a Day booking doesn't touch the night", () => {
    const a = adj({ type: "toil", day_night: "Day" });
    expect(run({ adjustments: [a] }).available).toBe(3);
    expect(run({ adjustments: [a], dayNight: "Night" }).available).toBe(4);
  });

  it("an H4H with a named cover nets out", () => {
    const r = run({ adjustments: [adj({ type: "h4h", covering_user_id: "x", covering_name: "X" })] });
    expect(r.available).toBe(4);
    expect(r.away[0].why).toBe("H4H");
    expect(r.covers).toEqual([{ id: "x", name: "X", why: "H4H cover" }]);
  });

  it("someone from another watch on Flexi payback adds one", () => {
    const r = run({ adjustments: [adj({ user_id: "y", user_name: "Y", type: "flexi_payback", watch_unit: "Red", covering_watch: "blue" })] });
    expect(r.available).toBe(5);
    expect(r.covers[0]).toMatchObject({ name: "Y", why: "Flexi payback" });
  });

  it("counts each person once, sickness first", () => {
    const r = run({
      absences: [{ person: "a", type: "sickness", start: "2026-11-10", end: "2026-11-10", back: null }],
      adjustments: [adj({ type: "flexi" })],
      detachedIds: new Set(["a", "c"]),
    });
    expect(r.away.map((x) => `${x.id}:${x.why}`)).toEqual(["a:Sick", "c:Detached"]);
    expect(r.available).toBe(2);
  });

  it("ignores people who aren't on the watch", () => {
    const r = run({ absences: [{ person: "zz", type: "AL", start: "2026-11-10", end: "2026-11-10", back: null }] });
    expect(r.available).toBe(4);
  });
});
