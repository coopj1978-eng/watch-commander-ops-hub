import { describe, expect, it } from "vitest";
import { hoursText, monthName, overtimeByMonth, overtimeIn, shiftHours } from "./overtime";

const ot = (start_date: string, overtime_hours: number | string) => ({ type: "overtime", start_date, overtime_hours });

describe("overtime per month", () => {
  it("adds the hours up by the month they were worked, newest first", () => {
    const r = overtimeByMonth([ot("2026-11-03", 10), ot("2026-11-20", "4.50"), ot("2026-10-31", 14)]);
    expect(r).toEqual([
      { month: "2026-11", hours: 14.5, shifts: 2 },
      { month: "2026-10", hours: 14, shifts: 1 },
    ]);
  });

  it("only counts overtime, not TOIL or other bookings", () => {
    const r = overtimeByMonth([ot("2026-11-03", 10), { type: "toil", start_date: "2026-11-04", overtime_hours: null }, { type: "orange_day", start_date: "2026-11-05" }]);
    expect(r).toEqual([{ month: "2026-11", hours: 10, shifts: 1 }]);
  });

  it("reads dates whether they come as strings or Dates", () => {
    expect(overtimeIn([{ type: "overtime", start_date: new Date("2026-12-01T00:00:00Z"), overtime_hours: 6 }], "2026-12")).toBe(6);
    expect(overtimeIn([ot("2026-12-01T00:00:00.000Z", 6)], "2026-11")).toBe(0);
  });

  it("knows a full shift's hours and writes hours plainly", () => {
    expect(shiftHours("Day")).toBe(10);
    expect(shiftHours("Night")).toBe(14);
    expect(hoursText(10)).toBe("10");
    expect(hoursText(4.5)).toBe("4.5");
    expect(monthName("2026-11")).toBe("November 2026");
  });
});
