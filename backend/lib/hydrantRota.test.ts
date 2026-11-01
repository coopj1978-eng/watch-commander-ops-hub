import { describe, expect, it } from "vitest";
import { cycleYear, groupFor, groupLabel, routeInGroup, watchForRoute, HYDRANT_WATCHES } from "./hydrantRota";

// The rota sheet on the board, row by row: the route group each watch has.
const SHEET: Record<number, string[]> = {
  1: ["SP 1 – 3", "SP 4 – 7", "SP 8 – 11", "SP 12 – 16", "SP 17 – 21"],
  4: ["SP 17 – 21", "SP 1 – 3", "SP 4 – 7", "SP 8 – 11", "SP 12 – 16"],
  8: ["SP 27 – 28B", "SP 29 – 30B", "SP 22 – 23B", "SP 24A – 25A", "SP 25B – 26B"],
  9: ["SP 36 – 38", "SP 39 – 40", "SP 31A – 31B", "SP 32A – 32B", "SP 33 – 35"],
  14: ["SP 24A – 25A", "SP 25B – 26B", "SP 27 – 28B", "SP 29 – 30B", "SP 22 – 23B"],
  15: ["SP 32A – 32B", "SP 33 – 35", "SP 36 – 38", "SP 39 – 40", "SP 31A – 31B"],
};

describe("hydrant rota", () => {
  it("counts 2019 as Year 1 and repeats every 15 years", () => {
    expect(cycleYear(2019)).toBe(1);
    expect(cycleYear(2026)).toBe(8);
    expect(cycleYear(2033)).toBe(15);
    expect(cycleYear(2034)).toBe(1);
  });

  it("matches the sheet on the board", () => {
    for (const [y, row] of Object.entries(SHEET)) {
      const year = 2018 + Number(y);
      expect(HYDRANT_WATCHES.map((w) => groupLabel(groupFor(w, year)!))).toEqual(row);
    }
  });

  it("covers every group once per watch over the cycle", () => {
    for (const w of HYDRANT_WATCHES) {
      const groups = new Set(Array.from({ length: 15 }, (_, i) => groupFor(w, 2019 + i)));
      expect(groups.size).toBe(15);
    }
  });

  it("puts each route half in the right group", () => {
    const g = (label: string) => Array.from({ length: 15 }, (_, i) => i).find((i) => groupLabel(i) === label)!;
    expect(["22", "22B", "23A", "23B"].every((r) => routeInGroup(r, g("SP 22 – 23B")))).toBe(true);
    expect(routeInGroup("24B", g("SP 22 – 23B"))).toBe(false);
    expect(["24A", "24B", "25A"].every((r) => routeInGroup(r, g("SP 24A – 25A")))).toBe(true);
    expect(routeInGroup("25B", g("SP 24A – 25A"))).toBe(false);
    expect(["25B", "26A", "26B"].every((r) => routeInGroup(r, g("SP 25B – 26B")))).toBe(true);
    expect(["1", "2A", "3A+AA", "3B"].every((r) => routeInGroup(r, g("SP 1 – 3")))).toBe(true);
    expect(["12A", "14", "14B", "16"].every((r) => routeInGroup(r, g("SP 12 – 16")))).toBe(true);
  });

  it("finds the watch for a route", () => {
    expect(watchForRoute("28A", 2026)).toBe("Green");
    expect(watchForRoute("30B", 2026)).toBe("Blue");
    expect(watchForRoute("23A", 2026)).toBe("White");
    expect(watchForRoute("1", 2026)).toBeNull(); // SP 1–3 isn't on Year 8's row
    expect(watchForRoute("38", 2027)).toBe("Green");
  });
});
