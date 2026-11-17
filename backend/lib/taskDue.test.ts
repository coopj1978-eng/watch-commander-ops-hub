import { describe, expect, it } from "vitest";
import { daysOverdue, isOverdue, overdueFrom } from "./taskDue";

describe("when a task is overdue", () => {
  // A card made on the 1st Night of Mon 16 Nov 2026: due at the shift's start.
  const due = "2026-11-16T18:00:00Z";
  it("not while its night shift is still running", () => {
    expect(isOverdue(due, new Date("2026-11-16T22:00:00Z"))).toBe(false);
    expect(isOverdue(due, new Date("2026-11-17T06:30:00Z"))).toBe(false);
  });
  it("from 08:00 the next morning", () => {
    expect(overdueFrom(due).toISOString()).toBe("2026-11-17T08:00:00.000Z");
    expect(isOverdue(due, new Date("2026-11-17T08:00:00Z"))).toBe(true);
    expect(daysOverdue(due, new Date("2026-11-17T09:00:00Z"))).toBe(1);
    expect(daysOverdue(due, new Date("2026-11-19T09:00:00Z"))).toBe(3);
  });
  it("a date-only due day lasts the whole day and its night", () => {
    expect(isOverdue("2026-11-16T00:00:00Z", new Date("2026-11-16T23:00:00Z"))).toBe(false);
    expect(isOverdue("2026-11-16T00:00:00Z", new Date("2026-11-17T08:01:00Z"))).toBe(true);
  });
  it("keeps to UK time in summer (08:00 BST is 07:00 UTC)", () => {
    expect(overdueFrom("2026-07-01T17:00:00Z").toISOString()).toBe("2026-07-02T07:00:00.000Z");
    // 23:30 UTC on 1 July is already 2 July in the UK.
    expect(overdueFrom("2026-07-01T23:30:00Z").toISOString()).toBe("2026-07-03T07:00:00.000Z");
  });
  it("nothing due is never overdue", () => {
    expect(isOverdue(null)).toBe(false);
  });
});
