import { describe, it, expect } from "vitest";
import type { crewing } from "@/client";
import { leaveLine, shiftLine, shiftTag } from "./myNextShifts";

// Local times — these run in the tester's own zone, like the browser.
const at = (date: string, h: number) => new Date(`${date}T${String(h).padStart(2, "0")}:00:00`);
const shift = (o: Partial<crewing.MyShift>): crewing.MyShift => ({
  date: "2026-11-09", shift_type: "2nd Night", watch: "Blue",
  start: at("2026-11-09", 18).toISOString(), end: at("2026-11-10", 8).toISOString(),
  state: "on", ...o,
});
const now = at("2026-11-09", 9);

describe("my next shifts wording", () => {
  it("tonight, tomorrow, then the day's date", () => {
    expect(shiftLine(shift({}), now)).toMatchObject({ when: "Tonight", date: "Mon 9", shift: "2nd Night", times: "18:00–08:00", tag: "On", night: true });
    const day = shift({ date: "2026-11-10", shift_type: "1st Day", start: at("2026-11-10", 8).toISOString(), end: at("2026-11-10", 18).toISOString() });
    expect(shiftLine(day, now)).toMatchObject({ when: "Tomorrow", date: "Tue 10", night: false });
    expect(shiftLine({ ...day, date: "2026-11-14" }, now)).toMatchObject({ when: "Sat 14", date: "" });
  });

  it("the shift running now says how long is left", () => {
    expect(shiftLine(shift({}), at("2026-11-10", 5))).toMatchObject({ when: "Now", detail: "3h 00m left", now: true });
  });

  it("your seat once crewing is set", () => {
    expect(shiftTag(shift({ seat: { appliance: "b10p1", role: "ba" } }))).toBe("B10P1 · BA");
  });

  it("off: why, and who's covering", () => {
    const l = shiftLine(shift({ state: "off", why: "H4H", with_name: "Jo Bloggs" }), now);
    expect(l).toMatchObject({ tag: "Off · H4H", detail: "Jo Bloggs covering", tone: "off" });
    expect(shiftTag(shift({ state: "off", why: "Flexi" }))).toBe("Off · Flexi day");
    expect(shiftTag(shift({ state: "off", why: "Sick" }))).toBe("Off sick");
  });

  it("an extra shift names the watch and who you cover", () => {
    const l = shiftLine(shift({ state: "extra", watch: "Red", shift_type: "1st Day", why: "H4H cover", with_name: "Andy J" }), now);
    expect(l).toMatchObject({ shift: "Red · 1st Day", tag: "Extra · H4H", detail: "Covering Andy J" });
  });

  it("detached says where", () => {
    expect(shiftLine(shift({ state: "detached", detached_to: "Kirkcaldy" }), now)).toMatchObject({ tag: "Detached", detail: "At Kirkcaldy" });
    expect(shiftTag(shift({ state: "detached", detached_to: "Kirkcaldy" }))).toBe("Detached · Kirkcaldy");
  });

  it("a request still waiting", () => {
    expect(shiftLine(shift({ waiting: "Flexi" }), now)).toMatchObject({ tag: "On", detail: "Flexi day asked for · waiting", waiting: true });
  });
});

describe("leave row", () => {
  const l = { start: "2026-11-26", end: "2026-12-13", back: "2026-12-14" };
  it("coming up", () => {
    expect(leaveLine(l, "2026-11-20")).toEqual({ title: "Annual leave", detail: "26 Nov – 13 Dec · back Mon 14 Dec" });
  });
  it("on it now", () => {
    expect(leaveLine(l, "2026-12-01")).toEqual({ title: "On annual leave", detail: "Back Mon 14 Dec" });
  });
});
