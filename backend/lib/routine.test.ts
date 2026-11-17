import { describe, expect, it } from "vitest";
import { cleanRoutineItems, mergeChecklist, routineSlotSpec, stampChecklist, routineRuleFires, ticksOnly } from "./routine";

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

describe("a line reworded in place", () => {
  const who = { id: "u2", name: "Iain" };
  const now = new Date("2026-11-17T10:00:00Z");
  const andy = { done: true, done_by: "u1", done_by_name: "Andy", done_at: "2026-11-17T09:00:00Z" };
  it("keeps who ticked it, under the new wording", () => {
    const before = [{ label: "Pump test", done: false }, { label: "BA sets", ...andy }];
    const out = stampChecklist(before, [{ label: "Pump test", done: false }, { label: "BA sets 1029 and 1032", done: true }], who, now);
    expect(out[1]).toEqual({ label: "BA sets 1029 and 1032", ...andy });
  });
  it("a new line added ticked is still stamped with whoever added it", () => {
    const before = [{ label: "BA sets", ...andy }];
    const out = stampChecklist(before, [{ label: "BA sets", done: true }, { label: "Radios", done: true }], who, now);
    expect(out[1].done_by).toBe("u2");
  });
  it("a line swapped for one that was already there is not a rewording", () => {
    const before = [{ label: "A", ...andy }, { label: "B", done: false }];
    // A removed, B now first and ticked, C added: B's tick is new, not Andy's.
    const out = stampChecklist(before, [{ label: "B", done: true }, { label: "C", done: false }], who, now);
    expect(out[0].done_by).toBe("u2");
  });
  it("reaches a routine card on the board without losing or doubling the tick", () => {
    const card = [{ label: "J4 check - pump 1", ...andy }, { label: "Hydrants", done: false }];
    const out = mergeChecklist(card, [{ label: "J4 check - B10P1", done: false }, { label: "Hydrants", done: false }]);
    expect(out).toEqual([{ label: "J4 check - B10P1", ...andy }, { label: "Hydrants", done: false }]);
  });
});

describe("ticksOnly", () => {
  it("applies ticks to the card's own lines and ignores any other change", () => {
    const before = [{ label: "A", done: false }, { label: "B", done: true, done_by: "u1" }, { label: "C", done: false }];
    const sent = [{ label: "A", done: true }, { label: "B reworded", done: false }, { label: "Extra", done: true }];
    expect(ticksOnly(before, sent)).toEqual([{ label: "A", done: true }, { label: "B", done: true, done_by: "u1" }, { label: "C", done: false }]);
  });
});

describe("routineRuleFires", () => {
  it("weekly cards come every week", () => {
    expect(routineRuleFires("weekly", "2026-11-30")).toBe(true);
    expect(routineRuleFires(null, "2026-11-03")).toBe(true);
  });
  it("first = the first of that weekday in the month", () => {
    expect(routineRuleFires("first", "2026-11-02")).toBe(true);  // Mon 2 Nov
    expect(routineRuleFires("first", "2026-11-09")).toBe(false);
    expect(routineRuleFires("first", "2026-11-07")).toBe(true);  // Sat 7 Nov
  });
  it("last = the last of that weekday in the month", () => {
    expect(routineRuleFires("last", "2026-11-27")).toBe(true);   // Fri 27 Nov (4 Dec is next)
    expect(routineRuleFires("last", "2026-11-20")).toBe(false);
    expect(routineRuleFires("last", "2026-02-24")).toBe(true);   // Tue 24 Feb 2026, 28-day month
  });
  it("quarter-last = last of that weekday in Jan, Apr, Jul, Oct", () => {
    expect(routineRuleFires("quarter-last", "2026-10-27")).toBe(true);  // last Tue of Oct
    expect(routineRuleFires("quarter-last", "2026-11-24")).toBe(false); // last Tue of Nov
    expect(routineRuleFires("quarter-last", "2027-01-26")).toBe(true);  // last Tue of Jan
    expect(routineRuleFires("quarter-last", "2026-10-20")).toBe(false);
  });
});
