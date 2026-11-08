import { describe, expect, it } from "vitest";
import { myDays, type MyBooking } from "./myShifts";

const ME = "me";
// The watch is on days on the 20th, nights on the 22nd, resting on the 24th.
const rota = (day: string) => (day === "2026-11-20" ? "Day" : day === "2026-11-22" ? "Night" : null);
const book = (b: Partial<MyBooking>): MyBooking => ({
  type: "flexi", start_date: "2026-11-20", end_date: "2026-11-20", user_id: ME, ...b,
});

describe("my days", () => {
  it("marks you off your watch's shift for a flexi day", () => {
    const r = myDays([book({ shift_day_night: "Day" })], ME, ["2026-11-20"], rota);
    expect(r.get("2026-11-20")).toEqual({ state: "off", label: "Flexi day" });
  });

  it("names who's covering your H4H", () => {
    const r = myDays([book({ type: "h4h", covering_name: "Jo Bloggs" })], ME, ["2026-11-20"], rota);
    expect(r.get("2026-11-20")?.label).toBe("H4H · Jo Bloggs covering");
  });

  it("ignores a booking for the other shift, and one on a rest day", () => {
    const r = myDays(
      [book({ shift_day_night: "Night" }), book({ start_date: "2026-11-24", end_date: "2026-11-24" })],
      ME, ["2026-11-20", "2026-11-24"], rota,
    );
    expect(r.size).toBe(0);
  });

  it("puts you in for an orange day on another watch", () => {
    const r = myDays(
      [book({ type: "orange_day", start_date: "2026-11-24", end_date: "2026-11-24", covering_watch: "Red", shift_day_night: "Day" })],
      ME, ["2026-11-24"], rota,
    );
    expect(r.get("2026-11-24")).toEqual({ state: "in", label: "Orange day · Red", shift: "Day" });
  });

  it("puts you in when you cover someone's H4H", () => {
    const r = myDays(
      [book({ type: "h4h", user_id: "jo", user_name: "Jo Bloggs", covering_user_id: ME, watch_unit: "Green", start_date: "2026-11-24", end_date: "2026-11-24", shift_day_night: "Night" })],
      ME, ["2026-11-24"], rota,
    );
    expect(r.get("2026-11-24")).toEqual({ state: "in", label: "H4H for Jo Bloggs · Green", shift: "Night" });
  });

  it("covers each day of a booking that runs over several days", () => {
    const r = myDays([book({ type: "training", start_date: "2026-11-20", end_date: "2026-11-22" })], ME, ["2026-11-20", "2026-11-21", "2026-11-22"], rota);
    expect([...r.keys()]).toEqual(["2026-11-20", "2026-11-22"]);
    expect(r.get("2026-11-22")?.label).toBe("Training");
  });

  it("shows a flexi you've asked for until it's decided, then the booking", () => {
    const asked = { type: "flexi", status: "with_wc", shift_date: "2026-11-20", day_night: "Day" as const, user_id: ME };
    expect(myDays([], ME, ["2026-11-20"], rota, [asked]).get("2026-11-20")).toEqual({ state: "asked", label: "Flexi day", shift: "Day" });
    expect(myDays([], ME, ["2026-11-20"], rota, [{ ...asked, status: "declined" }]).size).toBe(0);
    expect(myDays([book({ shift_day_night: "Day" })], ME, ["2026-11-20"], rota, [{ ...asked, status: "approved" }]).get("2026-11-20")?.state).toBe("off");
  });

  it("reads dates whether they come as strings or Dates", () => {
    const r = myDays([book({ start_date: new Date("2026-11-20T00:00:00Z"), end_date: "2026-11-20T00:00:00.000Z" })], ME, ["2026-11-20"], rota);
    expect(r.get("2026-11-20")?.state).toBe("off");
  });
});
