import { describe, expect, it } from "vitest";
import { cleanCardLinks, cleanLinkUrl, cleanRoutineItems, mergeCardLinks, mergeChecklist, routineSlotSpec, stampChecklist, routineRuleFires, ticksOnly, urlsByLabel } from "./routine";

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

describe("cleanRoutineItems links", () => {
  it("links an item's wording when given an address, by the item's place in the list", () => {
    const out = cleanRoutineItems(["BA sets", "", "Hydrants"], ["firescotland.sharepoint.com/ba", "", "https://maps.example.com/h"]);
    expect(out).toEqual([
      { label: "BA sets", done: false, url: "https://firescotland.sharepoint.com/ba" },
      { label: "Hydrants", done: false, url: "https://maps.example.com/h" },
    ]);
  });
  it("leaves out anything that isn't a web address", () => {
    const out = cleanRoutineItems(["A", "B", "C"], ["javascript:alert(1)", "not a link", "ftp://x.com/f"]);
    expect(out.every((i) => !("url" in i))).toBe(true);
  });
});

describe("cleanLinkUrl", () => {
  it("adds https:// and refuses other kinds of address", () => {
    expect(cleanLinkUrl("example.com/a")).toBe("https://example.com/a");
    expect(cleanLinkUrl("http://example.com")).toBe("http://example.com/");
    expect(cleanLinkUrl("mailto:a@b.com")).toBeNull();
    expect(cleanLinkUrl("data:text/html,hi")).toBeNull();
    expect(cleanLinkUrl("intranet")).toBeNull();
    expect(cleanLinkUrl("")).toBeNull();
  });
});

describe("urlsByLabel", () => {
  it("finds each item's link by its wording", () => {
    const existing = [{ label: "BA sets", done: false, url: "https://a.com/" }, { label: "J4", done: false }];
    expect(urlsByLabel(existing, ["j4", "ba sets ", "New"])).toEqual([null, "https://a.com/", null]);
  });
});

describe("cleanCardLinks", () => {
  it("keeps names, tidies addresses and drops repeats and non-links", () => {
    expect(cleanCardLinks(["Risk assessment\nexample.com/ra", "https://example.com/ra", "nope", "https://b.com/x"]))
      .toEqual(["Risk assessment\nhttps://example.com/ra", "https://b.com/x"]);
  });
  it("takes no more than ten", () => {
    expect(cleanCardLinks(Array.from({ length: 14 }, (_, i) => `https://e.com/${i}`))).toHaveLength(10);
  });
  it("is empty for anything that isn't a list", () => {
    expect(cleanCardLinks("https://e.com")).toEqual([]);
  });
});

describe("mergeCardLinks", () => {
  it("puts the routine's links first and keeps the card's own", () => {
    const card = ["https://old.com/", "Own\nhttps://mine.com/"];
    expect(mergeCardLinks(card, ["https://old.com/"], ["New\nhttps://new.com/"]))
      .toEqual(["New\nhttps://new.com/", "Own\nhttps://mine.com/"]);
  });
  it("renames a link without doubling it", () => {
    expect(mergeCardLinks(["https://a.com/"], ["https://a.com/"], ["Named\nhttps://a.com/"])).toEqual(["Named\nhttps://a.com/"]);
  });
  it("copes with a card that had none", () => {
    expect(mergeCardLinks(null, [], ["https://a.com/"])).toEqual(["https://a.com/"]);
  });
});

describe("mergeChecklist", () => {
  it("gives each item the template's link, keeping its tick", () => {
    const card = [{ label: "BA", done: true, done_by: "u1", url: "https://old.com/" }, { label: "J4", done: false }];
    const out = mergeChecklist(card, [{ label: "BA", done: false }, { label: "J4", done: false, url: "https://j4.com/" }]);
    expect(out).toEqual([{ label: "BA", done: true, done_by: "u1" }, { label: "J4", done: false, url: "https://j4.com/" }]);
  });

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
