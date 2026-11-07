import { describe, it, expect } from "vitest";
import { currentFyQuarter, fyQuarter, multiStoryPeriod, pace, quarterTime } from "./quarters";

describe("multi-storey programme quarters", () => {
  it("are calendar quarters, whichever financial quarter is showing", () => {
    expect(multiStoryPeriod(fyQuarter(2026, 1))).toEqual({ year: 2026, quarter: 2 }); // Apr–Jun
    expect(multiStoryPeriod(fyQuarter(2026, 2))).toEqual({ year: 2026, quarter: 3 }); // Jul–Sep
    expect(multiStoryPeriod(fyQuarter(2026, 3))).toEqual({ year: 2026, quarter: 4 }); // Oct–Dec
    expect(multiStoryPeriod(fyQuarter(2026, 4))).toEqual({ year: 2027, quarter: 1 }); // Jan–Mar
  });

  it("Jan–Mar of a calendar year belongs to that year's programme", () => {
    expect(multiStoryPeriod(fyQuarter(2025, 4))).toEqual({ year: 2026, quarter: 1 });
  });
});

describe("financial quarters", () => {
  it("Q3 is Oct–Dec of the financial year", () => {
    const q = fyQuarter(2026, 3);
    expect(q.start).toEqual(new Date(2026, 9, 1));
    expect(q.end).toEqual(new Date(2026, 11, 31));
    expect(q.label).toBe("Q3 2026/27");
  });

  it("Q4 runs Jan–Mar of the next calendar year", () => {
    const q = fyQuarter(2026, 4);
    expect(q.start).toEqual(new Date(2027, 0, 1));
    expect(q.end).toEqual(new Date(2027, 2, 31));
  });

  it("knows the current quarter, including Jan–Mar", () => {
    expect(currentFyQuarter(new Date(2026, 10, 1))).toMatchObject({ fy: 2026, q: 3 });
    expect(currentFyQuarter(new Date(2027, 1, 14))).toMatchObject({ fy: 2026, q: 4 });
    expect(currentFyQuarter(new Date(2026, 3, 1))).toMatchObject({ fy: 2026, q: 1 });
  });

  it("measures time through the quarter", () => {
    const q = fyQuarter(2026, 3); // 92 days
    expect(quarterTime(q, new Date(2026, 10, 1, 15))).toMatchObject({ phase: "now", dayOf: 32, totalDays: 92, daysLeft: 61 });
    expect(quarterTime(q, new Date(2026, 8, 30))).toMatchObject({ phase: "future", elapsed: 0 });
    expect(quarterTime(q, new Date(2027, 0, 2))).toMatchObject({ phase: "past", elapsed: 1 });
  });
});

describe("target pace", () => {
  it("5 of 36 a third of the way through is behind by 7", () => {
    expect(pace(5, 36, 32 / 92, "now")).toEqual({ state: "behind", expected: 12, behindBy: 7, remaining: 31 });
  });
  it("on or ahead of an even spread", () => {
    expect(pace(12, 36, 32 / 92, "now").state).toBe("on");
    expect(pace(20, 36, 32 / 92, "now").state).toBe("ahead");
  });
  it("late when behind in the last quarter of the time", () => {
    expect(pace(10, 36, 0.8, "now").state).toBe("late");
  });
  it("done needs the extra condition too (community TAP minimum)", () => {
    expect(pace(6, 6, 0.5, "now", false).state).not.toBe("done");
    expect(pace(6, 6, 0.5, "now", true).state).toBe("done");
  });
  it("past quarters are done or missed; future ones not started", () => {
    expect(pace(30, 36, 1, "past")).toMatchObject({ state: "missed", behindBy: 6 });
    expect(pace(0, 36, 0, "future").state).toBe("upcoming");
    expect(pace(0, 0, 0.5, "now").state).toBe("none");
  });
});
