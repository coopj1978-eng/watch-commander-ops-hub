import { describe, expect, it } from "vitest";
import { isIsoDay, niceDay, rosterCode, rosterDayText, sortImport } from "./rosterDays";

describe("what a schedule code means", () => {
  it("reads orange and purple shifts, day or night, weekend or not", () => {
    expect(rosterCode("OPD")).toEqual({ kind: "orange", day_night: "Day" });
    expect(rosterCode("opns")).toEqual({ kind: "orange", day_night: "Night" });
    expect(rosterCode("IPDS")).toEqual({ kind: "purple", day_night: "Day" });
    expect(rosterCode(" IPN ")).toEqual({ kind: "purple", day_night: "Night" });
  });
  it("reads courses, moved leave, flexi payback and shifts off the rota", () => {
    expect(rosterCode("TC")?.kind).toBe("training");
    expect(rosterCode("RALC")?.kind).toBe("leave");
    expect(rosterCode("ROFF")?.kind).toBe("leave");
    expect(rosterCode("FD")).toEqual({ kind: "payback", day_night: "Day" });
    expect(rosterCode("NS")).toEqual({ kind: "work", day_night: "Night" });
  });
  it("never keeps sickness, or a code it doesn't know", () => {
    expect(rosterCode("SLT")).toBeNull();
    expect(rosterCode("AL")).toBeNull();
    expect(rosterCode("HN")).toBeNull();
  });
});

describe("sorting a schedule file", () => {
  const users = new Map([["4000001", "u1"], ["4000002", "u2"]]);
  it("keeps the days it understands for the people it knows", () => {
    const r = sortImport([
      { service_number: "4000001", day: "2027-01-12", code: "OPN" },
      { service_number: "4000002", day: "2027-02-03", code: "IPD" },
    ], users);
    expect(r.days).toEqual([
      { user_id: "u1", day: "2027-01-12", kind: "orange", day_night: "Night", code: "OPN" },
      { user_id: "u2", day: "2027-02-03", kind: "purple", day_night: "Day", code: "IPD" },
    ]);
    expect(r).toMatchObject({ unmatched: [], skipped: {}, bad: 0 });
  });
  it("says who it couldn't match, what it skipped and which lines were wrong", () => {
    const r = sortImport([
      { service_number: "4999999", day: "2027-01-12", code: "OPN" },
      { service_number: "4000001", day: "2027-03-01", code: "SLT" },
      { service_number: "4000001", day: "2027-03-02", code: "SLT" },
      { service_number: "4000001", day: "2027-13-40", code: "OPD" },
      { service_number: "", day: "2027-01-01", code: "OPD" },
    ], users);
    expect(r.days).toEqual([]);
    expect(r.unmatched).toEqual(["4999999"]);
    expect(r.skipped).toEqual({ SLT: 2 });
    expect(r.bad).toBe(2);
  });
  it("keeps one day per person — the later line wins", () => {
    const r = sortImport([
      { service_number: "4000001", day: "2027-01-12", code: "OPN" },
      { service_number: "4000001", day: "2027-01-12", code: "OPD" },
    ], users);
    expect(r.days).toHaveLength(1);
    expect(r.days[0].day_night).toBe("Day");
  });
});

describe("wording", () => {
  it("checks a date is a real date", () => {
    expect(isIsoDay("2027-02-28")).toBe(true);
    expect(isIsoDay("2027-02-30")).toBe(false);
    expect(isIsoDay("12/01/2027")).toBe(false);
  });
  it("writes the day and what it is", () => {
    expect(niceDay("2027-01-05")).toBe("Tue 5 Jan 2027");
    expect(rosterDayText("orange", "Night")).toBe("an orange day (might be called in) · Night");
    expect(rosterDayText("training", null)).toBe("a training course day");
  });
});
