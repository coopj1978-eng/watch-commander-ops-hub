import { describe, it, expect } from "vitest";
import { thisMonth } from "./targets";

describe("this month so far", () => {
  const now = new Date(2026, 10, 9, 12); // 9 Nov 2026, local
  it("counts only this month's dates", () => {
    const r = thisMonth([
      new Date(2026, 10, 1, 10).toISOString(),
      new Date(2026, 10, 8, 20).toISOString(),
      new Date(2026, 9, 31, 10).toISOString(),
      null,
      undefined,
    ], 36, now);
    expect(r).toEqual({ month: "November", count: 2, pace: 12 });
  });
  it("community's 6 a quarter is 2 a month", () => {
    expect(thisMonth([], 6, now).pace).toBe(2);
  });
});
