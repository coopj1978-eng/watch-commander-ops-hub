import { describe, expect, it } from "vitest";
import { overtimeHoursProblem } from "./overtime";
import { shiftStrength, type StrengthAdjustment } from "./strength";

describe("overtime hours", () => {
  it("takes half-hours from half an hour to a whole day", () => {
    for (const ok of [0.5, 4, 4.5, 10, 14, 24]) expect(overtimeHoursProblem(ok)).toBeNull();
  });

  it("turns away nothing, too little, too much and odd minutes", () => {
    expect(overtimeHoursProblem(undefined)).toMatch(/how many hours/);
    expect(overtimeHoursProblem(Number.NaN)).toMatch(/how many hours/);
    expect(overtimeHoursProblem(0)).toMatch(/between half an hour and 24/);
    expect(overtimeHoursProblem(24.5)).toMatch(/between half an hour and 24/);
    expect(overtimeHoursProblem(4.25)).toMatch(/half-hours/);
  });
});

describe("overtime on the riding count", () => {
  const roster = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
  const overtime = (o: Partial<StrengthAdjustment>): StrengthAdjustment => ({
    user_id: "x", user_name: "Xavier", type: "overtime", start: "2026-11-10", end: "2026-11-10", day_night: "Day",
    watch_unit: "Red", covering_watch: "Blue", covering_user_id: null, covering_name: null, ...o,
  });
  const run = (adjustments: StrengthAdjustment[], dayNight: "Day" | "Night" = "Day") =>
    shiftStrength({ watch: "Blue", date: "2026-11-10", dayNight, roster, absences: [], adjustments });

  it("someone from another watch on overtime rides with the watch they're working with", () => {
    const r = run([overtime({})]);
    expect(r.covers).toEqual([{ id: "x", name: "Xavier", why: "Overtime" }]);
    expect(r.available).toBe(5);
  });

  it("only on the shift it's for, and only with that watch", () => {
    expect(run([overtime({})], "Night").available).toBe(4);
    expect(run([overtime({ covering_watch: "Green" })]).available).toBe(4);
  });

  it("overtime with your own watch doesn't count you twice", () => {
    const r = run([overtime({ user_id: "a", user_name: "A", watch_unit: "Blue" })]);
    expect(r).toMatchObject({ available: 4, covers: [], away: [] });
  });
});
