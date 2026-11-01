import { describe, expect, it } from "vitest";
import { cleanRoutineItems, mergeChecklist, routineSlotSpec, stampChecklist } from "./routine";

describe("routineSlotSpec", () => {
  it("makes a weekday's day and night routines", () => {
    expect(routineSlotSpec("MO-day")).toMatchObject({ title: "Monday routine", rrule: "FREQ=WEEKLY;BYDAY=MO;INTERVAL=1", shift_only: "day" });
    expect(routineSlotSpec("FR-night")).toMatchObject({ title: "Friday night routine", rrule: "FREQ=WEEKLY;BYDAY=FR;INTERVAL=1", shift_only: "night" });
  });
  it("makes the every-shift checks for both shifts", () => {
    expect(routineSlotSpec("every")).toMatchObject({ rrule: "FREQ=DAILY;INTERVAL=1", per_shift: true, shift_only: null });
  });
  it("refuses anything else", () => {
    expect(routineSlotSpec("XX-day")).toBeNull();
    expect(routineSlotSpec("MO-evening")).toBeNull();
    expect(routineSlotSpec("")).toBeNull();
  });
});

describe("cleanRoutineItems", () => {
  it("trims, drops blanks and repeats", () => {
    expect(cleanRoutineItems(["  Hydrants ", "", "hydrants", "Pump test"]).map((i) => i.label)).toEqual(["Hydrants", "Pump test"]);
  });
});

describe("mergeChecklist", () => {
  const ticked = { label: "J4", done: true, done_by: "u1", done_by_name: "Andy", done_at: "2026-11-02T09:00:00Z" };
  it("keeps ticks by label and adds new items unticked", () => {
    const out = mergeChecklist([ticked, { label: "Trauma", done: false }], [{ label: "J4", done: false }, { label: "Trauma", done: false }, { label: "BA", done: false }]);
    expect(out).toEqual([ticked, { label: "Trauma", done: false }, { label: "BA", done: false }]);
  });
  it("drops removed items unless someone already ticked them", () => {
    const out = mergeChecklist([ticked, { label: "Trauma", done: false }], [{ label: "BA", done: false }]);
    expect(out.map((i) => i.label)).toEqual(["BA", "J4"]);
  });
});

describe("stampChecklist", () => {
  const who = { id: "u2", name: "Iain" };
  const now = new Date("2026-11-02T10:00:00Z");
  it("stamps newly ticked items with who and when", () => {
    const out = stampChecklist([{ label: "J4", done: false }], [{ label: "J4", done: true }], who, now);
    expect(out[0]).toEqual({ label: "J4", done: true, done_by: "u2", done_by_name: "Iain", done_at: now.toISOString() });
  });
  it("keeps the server's stamp, never the client's", () => {
    const before = [{ label: "J4", done: true, done_by: "u1", done_by_name: "Andy", done_at: "2026-11-02T09:00:00Z" }];
    const out = stampChecklist(before, [{ label: "J4", done: true, done_by: "fake", done_by_name: "Someone else" }], who, now);
    expect(out[0].done_by).toBe("u1");
    expect(out[0].done_by_name).toBe("Andy");
  });
  it("clears the stamp when unticked, and won't take a client's stamp on a new tick", () => {
    expect(stampChecklist([{ label: "J4", done: true, done_by: "u1" }], [{ label: "J4", done: false, done_by: "u1" }], who, now)[0]).toEqual({ label: "J4", done: false });
    expect(stampChecklist([], [{ label: "New", done: true, done_by: "fake" }], who, now)[0].done_by).toBe("u2");
  });
});
