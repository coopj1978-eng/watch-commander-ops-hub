import { describe, expect, it } from "vitest";
import type { MyDay } from "./myShifts";
import { parseScheduleCsv, withRosterDays, type RosterDayLike } from "./rosterDays";

const day = (id: number, d: string, kind: RosterDayLike["kind"], extra: Partial<RosterDayLike> = {}): RosterDayLike =>
  ({ id, user_id: "me", day: d, kind, day_night: "Day", confirmed: false, ...extra });

describe("your roster days on your calendar", () => {
  it("shows an orange day as a faint 'maybe' until it's confirmed", () => {
    const r = withRosterDays(new Map(), [day(1, "2027-01-12", "orange", { day_night: "Night" })], "me");
    expect(r.get("2027-01-12")).toEqual({ state: "maybe", label: "Orange day", shift: "Night", tone: "maybe", rosterId: 1 });
  });

  it("shows a confirmed orange day as in, in orange — one entry with its booking", () => {
    const booking: MyDay = { state: "in", label: "Orange day · Green", shift: "Day", bookingId: 77, tone: "orange" };
    const r = withRosterDays(new Map([["2027-01-12", booking]]), [day(1, "2027-01-12", "orange", { confirmed: true })], "me");
    expect(r.get("2027-01-12")).toEqual({ ...booking, rosterId: 1 });
    // …and still as in if the booking list hasn't loaded yet
    expect(withRosterDays(new Map(), [day(1, "2027-01-12", "orange", { confirmed: true })], "me").get("2027-01-12"))
      .toMatchObject({ state: "in", tone: "orange", rosterId: 1 });
  });

  it("marks a purple shift without changing whether you're in", () => {
    const r = withRosterDays(new Map(), [day(2, "2027-02-03", "purple")], "me");
    expect(r.get("2027-02-03")).toEqual({ state: "note", label: "Purple shift", shift: "Day", tone: "purple", rosterId: 2 });
  });

  it("lets a booking already on the day win", () => {
    const flexi: MyDay = { state: "off", label: "Flexi day", bookingId: 5 };
    const r = withRosterDays(new Map([["2027-02-03", flexi]]), [day(2, "2027-02-03", "purple"), day(3, "2027-02-03", "orange")], "me");
    expect(r.get("2027-02-03")).toBe(flexi);
  });

  it("reads moved leave as off, a course as a note and a rostered shift as in", () => {
    const r = withRosterDays(new Map(), [
      day(4, "2027-03-01", "leave", { day_night: null }),
      day(5, "2027-03-02", "training", { day_night: null }),
      day(6, "2027-03-03", "work", { day_night: "Night" }),
    ], "me");
    expect(r.get("2027-03-01")).toMatchObject({ state: "off", label: "Leave (moved)" });
    expect(r.get("2027-03-02")).toMatchObject({ state: "note", label: "Training course" });
    expect(r.get("2027-03-03")).toMatchObject({ state: "in", shift: "Night" });
  });

  it("ignores other people's days", () => {
    expect(withRosterDays(new Map(), [day(1, "2027-01-12", "orange", { user_id: "someone" })], "me").size).toBe(0);
  });
});

describe("reading a schedule file", () => {
  it("reads payroll number, date and code, skipping the heading", () => {
    const r = parseScheduleCsv("payroll,date,code\n4000001,2027-01-12,OPN\n4000002,03/02/2027,ipd\n\n");
    expect(r).toEqual({
      rows: [
        { service_number: "4000001", day: "2027-01-12", code: "OPN" },
        { service_number: "4000002", day: "2027-02-03", code: "IPD" },
      ],
      bad: 0,
    });
  });
  it("counts lines it can't read", () => {
    const r = parseScheduleCsv("4000001;2027-01-12;OPN\n4000001;not a date;OPN\nrubbish line\n4000001\t2027-01-13\t");
    expect(r.rows).toHaveLength(1);
    expect(r.bad).toBe(3);
  });
});
