import { describe, expect, it } from "vitest";
import { barHeight, boardProgress, missedByDay, shortName } from "./pulse";

describe("missedByDay", () => {
  const missed = [{ date: "2026-11-10" }, { date: "2026-11-10T08:00:00Z" }, { date: "2026-11-12" }, { date: "2026-10-01" }];

  it("seven days ending today, oldest first", () => {
    const bars = missedByDay(missed, "2026-11-12");
    expect(bars.map((b) => b.date)).toEqual(["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(bars.map((b) => b.missed)).toEqual([0, 0, 0, 0, 2, 0, 1]);
    expect(bars[6].today).toBe(true);
    expect(bars.filter((b) => b.today)).toHaveLength(1);
  });

  it("weekday letters (12 Nov 2026 is a Thursday)", () => {
    expect(missedByDay([], "2026-11-12").map((b) => b.letter).join("")).toBe("FSSMTWT");
  });

  it("crosses a month end", () => {
    expect(missedByDay([], "2026-11-02", 3).map((b) => b.date)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("barHeight", () => {
  it("a clear day is a stub, a missed day is at least a readable bar", () => {
    expect(barHeight(0, 4)).toBe(0.14);
    expect(barHeight(1, 10)).toBe(0.28);
    expect(barHeight(4, 4)).toBe(1);
    expect(barHeight(3, 0)).toBe(0.14);
  });
});

describe("boardProgress", () => {
  it("counts done and started", () => {
    expect(boardProgress([{ status: "Done" }, { status: "InProgress" }, { status: "NotStarted" }, { status: "Done" }])).toEqual({ total: 4, done: 2, started: 1, share: 0.5 });
  });
  it("an empty board", () => {
    expect(boardProgress([])).toEqual({ total: 0, done: 0, started: 0, share: 0 });
  });
});

describe("shortName", () => {
  it("first name and surname initial", () => {
    expect(shortName("Jordan Horner")).toBe("Jordan H");
    expect(shortName("  Mary Anne  Smith ")).toBe("Mary S");
    expect(shortName("Tony")).toBe("Tony");
  });
});
