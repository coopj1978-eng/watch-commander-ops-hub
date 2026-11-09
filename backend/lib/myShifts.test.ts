import { describe, it, expect } from "vitest";
import { leaveBlock, myShifts } from "./myShifts";
import type { StrengthAdjustment } from "./strength";

// Blue Watch, Nov 2026: 1st Night Sun 8, 2nd Night Mon 9, rest 10–13,
// 1st Day Sat 14, 2nd Day Sun 15, 1st Night Mon 16, 2nd Night Tue 17.
// Red is on 1st Day Thu 12; Green on 2nd Night Wed 11.
const me = { id: "me", name: "Me" };
const adj = (o: Partial<StrengthAdjustment>): StrengthAdjustment => ({
  user_id: "me", user_name: "Me", type: "flexi", start: "2026-11-14", end: "2026-11-14", day_night: null,
  watch_unit: "Blue", covering_watch: null, covering_user_id: null, covering_name: null, ...o,
});
const run = (o: Partial<Parameters<typeof myShifts>[0]> = {}) =>
  myShifts({
    me, watch: "Blue", from: "2026-11-08", to: "2026-11-17", now: new Date("2026-11-09T07:25:00Z"),
    absences: [], adjustments: [], crewing: [], detachments: [], requests: [], ...o,
  }).shifts;
const on = (shifts: ReturnType<typeof run>, date: string) => shifts.find((s) => s.date === date && s.watch === "Blue");

describe("my next shifts", () => {
  it("follows the watch's rota, from the shift still running", () => {
    const s = run();
    expect(s.map((x) => `${x.date} ${x.shift_type} ${x.state}`)).toEqual([
      "2026-11-08 1st Night on", "2026-11-09 2nd Night on", "2026-11-14 1st Day on",
      "2026-11-15 2nd Day on", "2026-11-16 1st Night on", "2026-11-17 2nd Night on",
    ]);
    expect(s[0]).toMatchObject({ start: "2026-11-08T18:00:00.000Z", end: "2026-11-09T08:00:00.000Z" });
  });

  it("drops a shift once it has finished", () => {
    expect(run({ now: new Date("2026-11-09T08:00:00Z") })[0].date).toBe("2026-11-09");
  });

  it("a Flexi day takes you off that shift only", () => {
    const s = run({ adjustments: [adj({ type: "flexi", day_night: "Day" })] });
    expect(on(s, "2026-11-14")).toMatchObject({ state: "off", why: "Flexi" });
    expect(on(s, "2026-11-15")?.state).toBe("on");
  });

  it("an H4H names who covers you", () => {
    const s = run({ adjustments: [adj({ type: "h4h", covering_user_id: "jo", covering_name: "Jo Bloggs" })] });
    expect(on(s, "2026-11-14")).toMatchObject({ state: "off", why: "H4H", with_name: "Jo Bloggs" });
  });

  it("an open sickness takes you off every shift until booked back fit", () => {
    const sick = { person: "me", type: "sickness", start: "2026-11-01", end: "2026-11-01", back: null };
    expect(run({ absences: [sick] }).every((x) => x.state === "off" && x.why === "Sick")).toBe(true);
  });

  it("covering someone's H4H is an extra shift on their watch's shift", () => {
    const s = run({ adjustments: [adj({ type: "h4h", user_id: "andy", user_name: "Andy J", watch_unit: "Red", start: "2026-11-12", end: "2026-11-12", covering_user_id: "me" })] });
    expect(s.find((x) => x.state === "extra")).toMatchObject({ date: "2026-11-12", shift_type: "1st Day", watch: "Red", why: "H4H cover", with_name: "Andy J" });
  });

  it("an Orange day on another watch is an extra shift", () => {
    const s = run({ adjustments: [adj({ type: "orange_day", start: "2026-11-11", end: "2026-11-11", day_night: "Night", covering_watch: "Green" })] });
    expect(s.find((x) => x.state === "extra")).toMatchObject({ date: "2026-11-11", shift_type: "2nd Night", watch: "Green", why: "Orange day" });
    // It's not an off day on your own watch.
    expect(s.filter((x) => x.state === "off")).toEqual([]);
  });

  it("shows your seat once the crewing board is set", () => {
    const s = run({ crewing: [{ date: "2026-11-09", shift_type: "2nd Night", watch: "Blue", appliance: "b10p1", crew_role: "ba" }] });
    expect(on(s, "2026-11-09")).toMatchObject({ state: "on", seat: { appliance: "b10p1", role: "ba" } });
  });

  it("detached: working, at another station", () => {
    const s = run({
      crewing: [{ date: "2026-11-14", shift_type: "1st Day", watch: "Blue", appliance: "detached", crew_role: "detached" }],
      detachments: [{ date: "2026-11-14", to_station: "Kirkcaldy" }],
    });
    expect(on(s, "2026-11-14")).toMatchObject({ state: "detached", detached_to: "Kirkcaldy" });
  });

  it("a request still waiting shows on the shift; a booking wins over it", () => {
    const requests = [{ type: "flexi", date: "2026-11-15", day_night: "Day" as const }];
    expect(on(run({ requests }), "2026-11-15")).toMatchObject({ state: "on", waiting: "Flexi" });
    const booked = run({ requests, adjustments: [adj({ start: "2026-11-15", end: "2026-11-15" })] });
    expect(on(booked, "2026-11-15")).toMatchObject({ state: "off", why: "Flexi" });
    expect(on(booked, "2026-11-15")?.waiting).toBeUndefined();
  });

  it("no watch: only extra shifts", () => {
    expect(run({ watch: null })).toEqual([]);
  });
});

describe("leave block", () => {
  it("finds the next block and the first shift back", () => {
    expect(leaveBlock("Blue", "2026-11-20", "2026-11-30")).toEqual({ start: "2026-11-26", end: "2026-12-13", back: "2026-12-14" });
  });
  it("from inside the block, the same block", () => {
    expect(leaveBlock("Blue", "2026-12-01", "2026-12-10")?.start).toBe("2026-11-26");
  });
  it("none in the window", () => {
    expect(leaveBlock("Blue", "2026-11-08", "2026-11-20")).toBeNull();
  });
});
