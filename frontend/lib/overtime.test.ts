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

import { monthRange, monthShift, watchOvertime, watchOvertimeCsv } from "./overtime";

describe("a watch's overtime for one month", () => {
  const roster = [
    { id: "a", name: "Alex Able", system_role: "FF" },
    { id: "b", name: "Bea Baker", system_role: "CC" },
    { id: "c", name: "Cal Carr", system_role: "FF" },
  ];
  const b = (id: number, user_id: string, start_date: string, overtime_hours: number | string, extra: object = {}) =>
    ({ id, user_id, type: "overtime", start_date, overtime_hours, ...extra });

  it("totals each person, lists most hours first and keeps those with none", () => {
    const r = watchOvertime(roster, [
      b(1, "b", "2026-11-20", "4.50", { shift_day_night: "Night", covering_watch: "Red" }),
      b(2, "a", "2026-11-03", 10),
      b(3, "b", "2026-11-02", 10),
    ], "2026-11");
    expect(r.people.map((p) => [p.name, p.hours, p.entries.length])).toEqual([["Bea Baker", 14.5, 2], ["Alex Able", 10, 1], ["Cal Carr", 0, 0]]);
    expect(r.people[0].entries.map((e) => e.date)).toEqual(["2026-11-02", "2026-11-20"]);
    expect(r).toMatchObject({ hours: 24.5, entries: 3, withSome: 2 });
  });

  it("leaves out other months, other bookings and people who aren't on the watch", () => {
    const r = watchOvertime(roster, [
      b(1, "a", "2026-10-31", 14),
      b(2, "zz", "2026-11-05", 10),
      { id: 3, user_id: "a", type: "toil", start_date: "2026-11-06", overtime_hours: null },
    ], "2026-11");
    expect(r).toMatchObject({ hours: 0, entries: 0, withSome: 0 });
    expect(r.people).toHaveLength(3);
  });

  it("moves between months across a year end, and knows a month's first and last day", () => {
    expect(monthShift("2026-01", -1)).toBe("2025-12");
    expect(monthShift("2026-12", 1)).toBe("2027-01");
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("writes the month as a spreadsheet with a total per person and for the watch", () => {
    const csv = watchOvertimeCsv(watchOvertime(roster, [
      b(1, "a", "2026-11-03", 10, { shift_day_night: "Day", covering_watch: "Red", notes: 'Cover, "short" crew' }),
      b(2, "b", "2026-11-04", 4.5),
    ], "2026-11"));
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Name,Date,Shift,Hours,Worked with,Note");
    expect(lines[1]).toBe('Alex Able,2026-11-03,Day,10,Red Watch,"Cover, ""short"" crew"');
    expect(lines).toContain("Bea Baker,4.5,1");
    expect(lines[lines.length - 1]).toBe("Watch total,14.5,2");
  });
});
