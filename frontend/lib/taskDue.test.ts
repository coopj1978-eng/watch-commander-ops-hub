import { describe, expect, it } from "vitest";
import { dueDayDiff, isTaskOverdue } from "./taskDue";

describe("dueDayDiff", () => {
  const due = new Date(2026, 10, 16, 18, 0); // Mon 16 Nov 2026, the night shift's start
  it("a card made on a night shift isn't overdue after midnight", () => {
    expect(dueDayDiff(due, new Date(2026, 10, 16, 22, 0))).toBe(0);
    expect(dueDayDiff(due, new Date(2026, 10, 17, 6, 30))).toBe(0);
    expect(isTaskOverdue(due, new Date(2026, 10, 17, 6, 30))).toBe(false);
  });
  it("it is from 08:00 the next morning", () => {
    expect(dueDayDiff(due, new Date(2026, 10, 17, 8, 0))).toBe(-1);
    expect(isTaskOverdue(due, new Date(2026, 10, 17, 8, 0))).toBe(true);
    expect(dueDayDiff(due, new Date(2026, 10, 19, 3, 0))).toBe(-3);
  });
  it("future days count as before", () => {
    expect(dueDayDiff(new Date(2026, 10, 17), new Date(2026, 10, 17, 6, 30))).toBe(0);
    expect(dueDayDiff(new Date(2026, 10, 20), new Date(2026, 10, 17, 6, 30))).toBe(3);
  });
  it("nothing due is never overdue", () => {
    expect(isTaskOverdue(null)).toBe(false);
  });
});
