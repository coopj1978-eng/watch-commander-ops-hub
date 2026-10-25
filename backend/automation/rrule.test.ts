import { describe, it, expect } from "vitest";
import { rruleFiresOn } from "./rrule";

// Wed 21 Oct 2026, 10:00 BST
const CREATED = new Date("2026-10-21T09:00:00Z");

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Every day in [from, from + days) the rule fires on. */
function firings(rrule: string, from: string, days: number, created: Date | null = CREATED): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    if (rruleFiresOn(rrule, day, created)) out.push(day);
  }
  return out;
}

describe("rruleFiresOn — DAILY", () => {
  it("INTERVAL=1 fires every day", () => {
    expect(firings("FREQ=DAILY;INTERVAL=1", "2026-10-21", 5)).toHaveLength(5);
  });

  it("INTERVAL=3 fires every third day from the day it was created", () => {
    expect(firings("FREQ=DAILY;INTERVAL=3", "2026-10-19", 12)).toEqual([
      "2026-10-21",
      "2026-10-24",
      "2026-10-27",
      "2026-10-30",
    ]);
  });

  it("BYDAY limits the days", () => {
    expect(firings("FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR", "2026-10-24", 3)).toEqual(["2026-10-26"]);
  });
});

describe("rruleFiresOn — WEEKLY", () => {
  it("INTERVAL=1 with BYDAY fires every matching weekday (unchanged behaviour)", () => {
    expect(firings("FREQ=WEEKLY;BYDAY=MO;INTERVAL=1", "2026-10-21", 21)).toEqual([
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
    ]);
  });

  it("template manager fortnightly rule fires on alternate weeks, counted from the creation week", () => {
    // Created Wed 21 Oct: that week is week 0 (its Monday is before creation),
    // so the first card is Mon 2 Nov, then every other Monday.
    expect(firings("FREQ=WEEKLY;BYDAY=MO;INTERVAL=2", "2026-10-19", 45)).toEqual([
      "2026-11-02",
      "2026-11-16",
      "2026-11-30",
    ]);
  });

  it("every 2 weeks on several days fires all of them in the on-weeks only", () => {
    expect(firings("FREQ=WEEKLY;BYDAY=MO,TH;INTERVAL=2", "2026-10-19", 28)).toEqual([
      "2026-10-22",
      "2026-11-02",
      "2026-11-05",
    ]);
  });

  it("the 'Fortnightly' preset (no BYDAY) uses the creation weekday", () => {
    expect(firings("FREQ=WEEKLY;INTERVAL=2", "2026-10-19", 42)).toEqual([
      "2026-10-21",
      "2026-11-04",
      "2026-11-18",
    ]);
  });

  it("stays exactly 14 days apart for a year, across both clock changes", () => {
    const days = firings("FREQ=WEEKLY;BYDAY=TU;INTERVAL=2", "2026-10-21", 400);
    expect(days.length).toBeGreaterThan(25);
    for (let i = 1; i < days.length; i++) {
      expect(addDays(days[i - 1], 14)).toBe(days[i]);
    }
  });

  it("a weekend pair stays in the same week (weeks start Monday)", () => {
    expect(firings("FREQ=WEEKLY;BYDAY=SA,SU;INTERVAL=2", "2026-10-21", 21)).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("WKST=SU moves Sunday into the following week", () => {
    expect(firings("FREQ=WEEKLY;BYDAY=SA,SU;INTERVAL=2;WKST=SU", "2026-10-21", 21)).toEqual([
      "2026-10-24",
      "2026-11-01",
      "2026-11-07",
    ]);
  });
});

describe("rruleFiresOn — MONTHLY", () => {
  it("INTERVAL=1 with no day still fires on the 1st", () => {
    expect(firings("FREQ=MONTHLY;INTERVAL=1", "2026-10-21", 75)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });

  it("INTERVAL=3 fires every third month from the creation month", () => {
    // Oct is month 0 (1 Oct is before creation), so Jan, Apr, Jul, Oct.
    const days = firings("FREQ=MONTHLY;INTERVAL=3", "2026-10-21", 370);
    expect(days).toEqual(["2027-01-01", "2027-04-01", "2027-07-01", "2027-10-01"]);
  });

  it("BYMONTHDAY accepts a list, with -1 as the last day of the month", () => {
    expect(firings("FREQ=MONTHLY;BYMONTHDAY=15,-1", "2027-02-01", 31)).toEqual(["2027-02-15", "2027-02-28"]);
  });

  it("BYMONTHDAY with INTERVAL=2 skips the off months", () => {
    expect(firings("FREQ=MONTHLY;BYMONTHDAY=10;INTERVAL=2", "2026-10-21", 120)).toEqual(["2026-12-10", "2027-02-10"]);
  });
});

describe("rruleFiresOn — anchor", () => {
  it("uses the UK day the template was created, not the UTC day", () => {
    // 23:30 UTC on Tue 20 Oct is 00:30 BST on Wed 21 Oct.
    const created = new Date("2026-10-20T23:30:00Z");
    expect(firings("FREQ=DAILY;INTERVAL=2", "2026-10-20", 5, created)).toEqual(["2026-10-21", "2026-10-23"]);
  });

  it("accepts created_at as a string", () => {
    expect(rruleFiresOn("FREQ=DAILY;INTERVAL=2", "2026-10-23", "2026-10-21T09:00:00.000Z")).toBe(true);
    expect(rruleFiresOn("FREQ=DAILY;INTERVAL=2", "2026-10-22", "2026-10-21T09:00:00.000Z")).toBe(false);
  });

  it("a DTSTART line overrides created_at, and nothing fires before it", () => {
    const rule = "DTSTART:20261109T090000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO;INTERVAL=2";
    expect(firings(rule, "2026-10-21", 42)).toEqual(["2026-11-09", "2026-11-23"]);
  });

  it("a DTSTART= part works too, and sets the monthly day", () => {
    expect(firings("FREQ=MONTHLY;INTERVAL=2;DTSTART=20261115", "2026-10-21", 100)).toEqual(["2026-11-15", "2027-01-15"]);
  });

  it("with no anchor at all, alternate weeks are still stable", () => {
    const days = firings("FREQ=WEEKLY;INTERVAL=2", "2026-10-19", 56, null);
    expect(days).toHaveLength(4);
    expect(new Set(days.map((d) => new Date(d + "T00:00:00Z").getUTCDay()))).toEqual(new Set([1]));
    for (let i = 1; i < days.length; i++) expect(addDays(days[i - 1], 14)).toBe(days[i]);
  });
});

describe("rruleFiresOn — bad input", () => {
  it("no FREQ never fires", () => {
    expect(firings("BYDAY=MO", "2026-10-21", 14)).toEqual([]);
  });

  it("INTERVAL=0 or junk is treated as 1", () => {
    expect(firings("FREQ=DAILY;INTERVAL=0", "2026-10-21", 3)).toHaveLength(3);
    expect(firings("FREQ=DAILY;INTERVAL=abc", "2026-10-21", 3)).toHaveLength(3);
  });

  it("unsupported frequencies never fire", () => {
    expect(firings("FREQ=YEARLY", "2026-10-21", 400)).toEqual([]);
  });
});
