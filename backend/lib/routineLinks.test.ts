import { describe, expect, it } from "vitest";
import { cleanChecklistLinks, cleanLineUrl, cleanRoutineItems, mergeChecklist, stampChecklist, ticksOnly } from "./routine";

// A tick line can open a web page (John, 25 Nov 2026: "the tick part to be
// left tickable but the text to be linkable").

describe("a line's link", () => {
  it("keeps a web address and nothing else", () => {
    expect(cleanLineUrl("https://example.org/guide")).toBe("https://example.org/guide");
    expect(cleanLineUrl("  http://example.org  ")).toBe("http://example.org");
    expect(cleanLineUrl("javascript:alert(1)")).toBeUndefined();
    expect(cleanLineUrl("example.org")).toBeUndefined();
    expect(cleanLineUrl("https://example.org/a b")).toBeUndefined();
    expect(cleanLineUrl(undefined)).toBeUndefined();
  });

  it("drops a bad link but keeps the line", () => {
    expect(cleanChecklistLinks([
      { label: "BA sets", done: false, url: "https://example.org/ba" },
      { label: "Ladders", done: true, url: "file:///etc/passwd" },
      { label: "Hose", done: false },
    ])).toEqual([
      { label: "BA sets", done: false, url: "https://example.org/ba" },
      { label: "Ladders", done: true },
      { label: "Hose", done: false },
    ]);
  });

  it("is put on the weekly routine's lines by their wording", () => {
    expect(cleanRoutineItems(["BA sets", "Ladders"], [{ label: "ba sets", url: "https://example.org/ba" }, { label: "Ladders", url: "nope" }])).toEqual([
      { label: "BA sets", done: false, url: "https://example.org/ba" },
      { label: "Ladders", done: false },
    ]);
    // no links given: as before
    expect(cleanRoutineItems(["BA sets"])).toEqual([{ label: "BA sets", done: false }]);
  });
});

describe("a link and the cards already on the board", () => {
  const who = { id: "u1", name: "Sam" };

  it("reaches a card from the check it came from, keeping the tick", () => {
    const card = [{ label: "BA sets", done: true, done_by: "u1", done_by_name: "Sam", done_at: "2026-11-25T09:00:00.000Z" }];
    const merged = mergeChecklist(card, [{ label: "BA sets", done: false, url: "https://example.org/ba" }]);
    expect(merged).toEqual([{ ...card[0], url: "https://example.org/ba" }]);
  });

  it("comes off the card when it's taken off the check", () => {
    const merged = mergeChecklist([{ label: "BA sets", done: false, url: "https://example.org/old" }], [{ label: "BA sets", done: false }]);
    expect(merged).toEqual([{ label: "BA sets", done: false }]);
  });

  it("stays on the line when someone ticks it", () => {
    const before = [{ label: "BA sets", done: false, url: "https://example.org/ba" }];
    const ticked = ticksOnly(before, [{ label: "BA sets", done: true }]);
    expect(ticked[0].url).toBe("https://example.org/ba");
    const stamped = stampChecklist(before, ticked, who, new Date("2026-11-25T09:00:00Z"));
    expect(stamped[0]).toMatchObject({ label: "BA sets", done: true, url: "https://example.org/ba", done_by: "u1" });
  });

  it("can't be added by someone who may only tick", () => {
    const before = [{ label: "BA sets", done: false }];
    expect(ticksOnly(before, [{ label: "BA sets", done: true, url: "https://example.org/sneaky" }])[0].url).toBeUndefined();
  });
});
