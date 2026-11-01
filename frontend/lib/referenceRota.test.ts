import { describe, expect, it } from "vitest";
import { nextChangeYear, periodLabel, referenceHolders, watchReferences, REFERENCE_WATCHES } from "./referenceRota";

// The planner on the station board: [main, secondary] per watch for each block.
const SHEET: Record<number, Record<string, [number, number]>> = {
  2022: { Green: [1, 2], Blue: [2, 3], White: [3, 4], Red: [4, 5], Amber: [5, 1] },
  2024: { Green: [2, 3], Blue: [3, 4], White: [4, 5], Red: [5, 1], Amber: [1, 2] },
  2026: { Green: [3, 4], Blue: [4, 5], White: [5, 1], Red: [1, 2], Amber: [2, 3] },
  2028: { Green: [4, 5], Blue: [5, 1], White: [1, 2], Red: [2, 3], Amber: [3, 4] },
  2030: { Green: [5, 1], Blue: [1, 2], White: [2, 3], Red: [3, 4], Amber: [4, 5] },
};

describe("reference rota", () => {
  it("matches the 10-year planner, both years of each block", () => {
    for (const [start, row] of Object.entries(SHEET)) {
      for (const year of [Number(start), Number(start) + 1]) {
        for (const [watch, [main, secondary]] of Object.entries(row)) {
          expect(watchReferences(watch, year)).toEqual({ main, secondary });
        }
      }
    }
  });

  it("repeats every ten years", () => {
    for (const w of REFERENCE_WATCHES) expect(watchReferences(w, 2032)).toEqual(watchReferences(w, 2022));
  });

  it("names the main and secondary watch for a reference", () => {
    expect(referenceHolders(2, 2026)).toEqual({ main: "Amber", secondary: "Red" });
    expect(referenceHolders(4, 2027)).toEqual({ main: "Blue", secondary: "Green" });
    expect(referenceHolders(1, 2028)).toEqual({ main: "White", secondary: "Blue" });
  });

  it("labels the block and when it changes", () => {
    expect(periodLabel(2026)).toBe("2026–2027");
    expect(periodLabel(2027)).toBe("2026–2027");
    expect(nextChangeYear(2026)).toBe(2028);
    expect(nextChangeYear(2027)).toBe(2028);
  });
});
