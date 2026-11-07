import { describe, expect, it } from "vitest";
import { watchInPlan, watchInYear } from "./multistoryProgramme";

// The sheet's five columns in 2026, left to right.
const COLUMNS_2026 = ["White", "Red", "Amber", "Blue", "Green"];
const columnsIn = (year: number) => COLUMNS_2026.map((w) => watchInYear(w, year));

describe("multi-storey programme moving along each January", () => {
  it("leaves 2026 as the plan has it", () => {
    expect(columnsIn(2026)).toEqual(COLUMNS_2026);
  });

  it("gives the order printed on the sheet for 2025", () => {
    expect(columnsIn(2025)).toEqual(["Red", "Amber", "Blue", "Green", "White"]);
  });

  it("moves every watch one column to the right for 2027", () => {
    expect(columnsIn(2027)).toEqual(["Green", "White", "Red", "Amber", "Blue"]);
  });

  it("comes back round after five years", () => {
    expect(columnsIn(2031)).toEqual(COLUMNS_2026);
  });

  it("turns a watch chosen for any year back into the plan's watch", () => {
    for (const year of [2025, 2026, 2027, 2028, 2035]) {
      for (const watch of COLUMNS_2026) {
        expect(watchInYear(watchInPlan(watch, year), year)).toBe(watch);
      }
    }
  });

  it("leaves a name it doesn't know alone", () => {
    expect(watchInYear("Purple", 2027)).toBe("Purple");
  });
});
