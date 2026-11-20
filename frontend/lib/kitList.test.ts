import { describe, expect, it } from "vitest";
import { kitSections, lockersOf, moveItem, moveSection, shelvesOf, whereKept, type KitItem } from "./kitList";

const kit = (name: string, sort_order: number, locker?: string, shelf?: string, category = "Other"): KitItem =>
  ({ name, sort_order, locker, shelf, category });

describe("kit by locker and shelf", () => {
  const items = [
    kit("Spade", 40, "Locker 7", "Shelf 5"),
    kit("Radio", 10, "Front Cab"),
    kit("Guidelines", 20, "Locker 7", "Shelf 1"),
    kit("Fork", 50, "Locker 7", "Shelf 5"),
    kit("Pager", 15, "Front Cab"),
    kit("Spill kit", 30, "locker 7 ", "Shelf 2"),
  ];

  it("follows the folder: lockers in list order, shelves in order, items in order", () => {
    const s = kitSections(items);
    expect(s.map((x) => x.name)).toEqual(["Front Cab", "Locker 7"]);
    expect(s[0].shelves).toEqual([{ name: "", items: [items[1], items[4]] }]);
    expect(s[1].shelves.map((x) => x.name)).toEqual(["Shelf 1", "Shelf 2", "Shelf 5"]);
    expect(s[1].shelves[2].items.map((i) => i.name)).toEqual(["Spade", "Fork"]);
    expect(s[1].count).toBe(4);
  });

  it("treats a locker's name the same whatever its capitals or spaces", () => {
    expect(kitSections(items)).toHaveLength(2);
  });

  it("puts kit with no locker after the lockers, under its type", () => {
    const s = kitSections([kit("9m Ladder", 0, undefined, undefined, "Ladders"), kit("BA Set", 0, null as never, "Shelf 1", "BA"), ...items]);
    expect(s.map((x) => x.name)).toEqual(["Front Cab", "Locker 7", "Ladders", "Breathing Apparatus"]);
    expect(s[2].isLocker).toBe(false);
    // A shelf means nothing without a locker.
    expect(s[3].shelves).toEqual([{ name: "", items: [expect.objectContaining({ name: "BA Set" })] }]);
  });

  it("an appliance with no lockers yet still groups by type, as it did", () => {
    const s = kitSections([kit("70mm Hose", 0, undefined, undefined, "Hose"), kit("45mm Hose", 0, undefined, undefined, "Hose")]);
    expect(s).toHaveLength(1);
    expect(s[0].shelves[0].items.map((i) => i.name)).toEqual(["45mm Hose", "70mm Hose"]);
  });

  it("lists the lockers in use and says where an item is kept", () => {
    expect(lockersOf(items)).toEqual(["Front Cab", "Locker 7"]);
    expect(whereKept({ locker: "Locker 7", shelf: "Shelf 5" })).toBe("Locker 7 · Shelf 5");
    expect(whereKept({ locker: "Front Cab", shelf: null })).toBe("Front Cab");
    expect(whereKept({ locker: null, shelf: "Shelf 5" })).toBe("");
  });
});

describe("moving kit up and down", () => {
  const item = (id: number, name: string, sort_order: number, locker?: string, shelf?: string) =>
    ({ id, name, sort_order, locker, shelf, category: "Other" });
  const list = [
    item(1, "Radio", 10, "Front Cab"),
    item(2, "Pager", 20, "Front Cab"),
    item(3, "Guidelines", 30, "Locker 7", "Shelf 1"),
    item(4, "Spade", 40, "Locker 7", "Shelf 5"),
    item(5, "Fork", 50, "Locker 7", "Shelf 5"),
    item(6, "9m Ladder", 60),
  ];
  const sections = kitSections(list);

  it("swaps an item with its neighbour on the same shelf", () => {
    expect(moveItem(sections, 5, -1)).toEqual([1, 2, 3, 5, 4, 6]);
    expect(moveItem(sections, 1, 1)).toEqual([2, 1, 3, 4, 5, 6]);
  });

  it("won't move an item off the end of its shelf", () => {
    expect(moveItem(sections, 4, -1)).toBeNull();
    expect(moveItem(sections, 5, 1)).toBeNull();
    expect(moveItem(sections, 99, 1)).toBeNull();
  });

  it("moves a whole locker past the next one, leaving kit with no locker last", () => {
    expect(moveSection(sections, sections[1].key, -1)).toEqual([3, 4, 5, 1, 2, 6]);
    expect(moveSection(sections, sections[0].key, -1)).toBeNull();
    expect(moveSection(sections, sections[1].key, 1)).toBeNull();
  });

  it("lists a locker's shelves for the add form", () => {
    expect(shelvesOf(list, "locker 7")).toEqual(["Shelf 1", "Shelf 5"]);
    expect(shelvesOf(list, "Front Cab")).toEqual([]);
  });
});
