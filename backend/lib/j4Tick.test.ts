import { describe, expect, it } from "vitest";
import { appliancesNamed, isJ4CheckLine, statusAfterTick, tickJ4Lines } from "./j4Tick";

const callSigns = ["B10P1", "B10P2", "B10T1"];
const withKit = ["B10P1", "B10P2"];
const who = { id: "u1", name: "A Firefighter" };
const now = new Date("2026-11-10T09:00:00Z");
const item = (label: string, done = false) => ({ label, done });

describe("isJ4CheckLine", () => {
  it("only lines that start 'J4 check'", () => {
    expect(isJ4CheckLine("J4 check – B10P1")).toBe(true);
    expect(isJ4CheckLine("J4 checks")).toBe(true);
    expect(isJ4CheckLine("  j4 Check B10P2")).toBe(true);
    expect(isJ4CheckLine("General checks – J4 / BA / pumps")).toBe(false);
    expect(isJ4CheckLine("J4 trauma and first aid stock – order")).toBe(false);
    expect(isJ4CheckLine("J4 update to Station Manager – missing items")).toBe(false);
  });
});

describe("appliancesNamed", () => {
  it("finds the call sign however it's spaced", () => {
    expect(appliancesNamed("J4 check – B10P1", callSigns)).toEqual(["B10P1"]);
    expect(appliancesNamed("J4 check b10 p2", callSigns)).toEqual(["B10P2"]);
    expect(appliancesNamed("J4 check – B10P1 and B10P2", callSigns)).toEqual(["B10P1", "B10P2"]);
    expect(appliancesNamed("J4 checks", callSigns)).toEqual([]);
  });
});

describe("tickJ4Lines", () => {
  const card = [item("J4 check – B10P1"), item("J4 check – B10P2"), item("General checks – BA / pumps"), item("Smoke alarm count")];

  it("ticks only the pump that was checked, with who and when", () => {
    const r = tickJ4Lines(card, { callSigns, withKit, checked: ["B10P1"], who, now });
    expect(r.ticked).toEqual(["J4 check – B10P1"]);
    expect(r.checklist[0]).toEqual({ label: "J4 check – B10P1", done: true, done_by: "u1", done_by_name: "A Firefighter", done_at: now.toISOString() });
    expect(r.checklist.slice(1).every((c) => !c.done)).toBe(true);
  });

  it("ticks both once both are checked, and never the other lines", () => {
    const r = tickJ4Lines(card, { callSigns, withKit, checked: ["B10P1", "B10P2"], who, now });
    expect(r.checklist.map((c) => c.done)).toEqual([true, true, false, false]);
  });

  it("a line already ticked keeps who ticked it", () => {
    const before = [{ label: "J4 check – B10P1", done: true, done_by: "u0", done_by_name: "Someone Else", done_at: "2026-11-10T08:10:00.000Z" }];
    const r = tickJ4Lines(before, { callSigns, withKit, checked: ["B10P1"], who, now });
    expect(r.ticked).toEqual([]);
    expect(r.checklist[0].done_by).toBe("u0");
  });

  it("a line naming no appliance waits for every appliance with a kit list", () => {
    const generic = [item("J4 checks")];
    expect(tickJ4Lines(generic, { callSigns, withKit, checked: ["B10P1"], who, now }).ticked).toEqual([]);
    expect(tickJ4Lines(generic, { callSigns, withKit, checked: ["B10P2", "B10P1"], who, now }).ticked).toEqual(["J4 checks"]);
  });

  it("nothing to tick when no appliance has a kit list", () => {
    expect(tickJ4Lines([item("J4 checks")], { callSigns, withKit: [], checked: [], who, now }).ticked).toEqual([]);
  });

  it("leaves the combined and stock lines alone", () => {
    const r = tickJ4Lines([item("General checks – J4 / BA / pumps"), item("J4 trauma and first aid stock – order")], { callSigns, withKit, checked: withKit, who, now });
    expect(r.ticked).toEqual([]);
  });
});

describe("statusAfterTick", () => {
  it("first tick starts the card, last tick finishes it", () => {
    expect(statusAfterTick("NotStarted", [{ done: true }, { done: false }])).toBe("InProgress");
    expect(statusAfterTick("InProgress", [{ done: true }, { done: false }])).toBeNull();
    expect(statusAfterTick("InProgress", [{ done: true }, { done: true }])).toBe("Done");
    expect(statusAfterTick("NotStarted", [{ done: true }])).toBe("Done");
  });

  it("leaves blocked, done and custom columns alone", () => {
    expect(statusAfterTick("Blocked", [{ done: true }, { done: true }])).toBeNull();
    expect(statusAfterTick("Done", [{ done: true }])).toBeNull();
    expect(statusAfterTick("NotStarted", [{ done: false }])).toBeNull();
  });
});
