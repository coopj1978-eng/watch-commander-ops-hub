import { describe, expect, it } from "vitest";
import { awayText, barHeight, boardProgress, comingShifts, dayLabel, daysBetween, missedByDay, shortName, tightestShift } from "./pulse";

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

describe("coming shifts", () => {
  const shifts = [
    { date: "2026-11-21", available: 9, pumps: 2 },
    { date: "2026-11-16", available: 9, pumps: 2 },
    { date: "2026-11-17", available: 8, pumps: 2 },
    { date: "2026-11-20", available: 7, pumps: 1 },
    { date: "2026-11-22", available: 6, pumps: 1 },
    { date: "2026-11-26", available: 10, pumps: 2 },
  ];
  it("the next four from the next shift's date, soonest first", () => {
    expect(comingShifts(shifts, "2026-11-17").map((s) => s.date)).toEqual(["2026-11-17", "2026-11-20", "2026-11-21", "2026-11-22"]);
  });
  it("the tightest is the one that rides fewest pumps, then has fewest people", () => {
    expect(tightestShift(comingShifts(shifts, "2026-11-17"))?.date).toBe("2026-11-22");
    expect(tightestShift([{ date: "a", available: 9, pumps: 2 }, { date: "b", available: 9, pumps: 2 }])?.date).toBe("a");
    expect(tightestShift([])).toBeUndefined();
  });
  it("labels a day (17 Nov 2026 is a Tuesday)", () => {
    expect(dayLabel("2026-11-17")).toBe("Tue 17");
    expect(dayLabel("2026-12-01T00:00:00Z")).toBe("Tue 1");
  });
  it("says who's away and why, two names at most", () => {
    expect(awayText([])).toBe("");
    expect(awayText([{ name: "Andy James", why: "Flexi" }])).toBe("Andy J flexi");
    expect(awayText([{ name: "Andy James", why: "Flexi" }, { name: "Jordan Horner", why: "Sick" }, { name: "Chris Wilson", why: "Leave" }])).toBe("Andy J flexi, Jordan H sick +1");
    expect(awayText([{ why: "Leave" }, { why: "Leave" }])).toBe("2 away");
  });
  it("counts days since someone was last out", () => {
    expect(daysBetween("2026-10-14", "2026-11-17")).toBe(34);
    expect(daysBetween("2026-11-20", "2026-11-17")).toBe(0);
  });
});
