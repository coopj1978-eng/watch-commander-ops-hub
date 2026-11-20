import { describe, expect, it } from "vitest";
import { inSection, reordered, sectionNameProblem } from "./kitSections";

describe("kit headings", () => {
  const item = { locker: "Offside Front · Locker 7", shelf: "Shelf 5" };

  it("a locker heading covers every shelf in it", () => {
    expect(inSection(item, { locker: "offside front · locker 7 " })).toBe(true);
    expect(inSection(item, { locker: "Front Cab" })).toBe(false);
  });

  it("a shelf heading covers only that shelf of that locker", () => {
    expect(inSection(item, { locker: "Offside Front · Locker 7", shelf: "shelf 5" })).toBe(true);
    expect(inSection(item, { locker: "Offside Front · Locker 7", shelf: "Shelf 6" })).toBe(false);
    expect(inSection({ locker: "Front Cab", shelf: "Shelf 5" }, { locker: "Offside Front · Locker 7", shelf: "Shelf 5" })).toBe(false);
    // The part of a locker with no shelf.
    expect(inSection({ locker: "Front Cab", shelf: null }, { locker: "Front Cab", shelf: "" })).toBe(true);
  });

  it("kit with no locker is never under a heading", () => {
    expect(inSection({ locker: null, shelf: null }, { locker: "" })).toBe(false);
  });

  it("a heading needs a sensible name", () => {
    expect(sectionNameProblem("  ")).toMatch(/name/);
    expect(sectionNameProblem("x".repeat(81))).toMatch(/80/);
    expect(sectionNameProblem("Nearside Rear · Locker 3")).toBeNull();
  });
});

describe("reordering the list", () => {
  it("takes the new order", () => {
    expect(reordered([1, 2, 3, 4], [2, 1, 3, 4])).toEqual([2, 1, 3, 4]);
  });

  it("keeps anything a stale screen left out, and ignores ids it doesn't know or repeats", () => {
    expect(reordered([1, 2, 3, 4], [3, 99, 1, 3])).toEqual([3, 1, 2, 4]);
  });
});
