import { describe, it, expect } from "vitest";
import { crewingBoardShiftFor, crewingShiftFor, currentDayNight, rotaDayNight } from "./shiftRota";

// Blue Watch, Nov 2026: 9th 2nd Night, 10–13 rest, 14th 1st Day.
describe("Day or Night from the rota", () => {
  it("reads the watch's shift for a date", () => {
    expect(rotaDayNight("Blue", "2026-11-09")).toBe("Night");
    expect(rotaDayNight("Blue", "2026-11-14")).toBe("Day");
  });
  it("nothing on a rest day, a bad date or no watch", () => {
    expect(rotaDayNight("Blue", "2026-11-10")).toBeNull();
    expect(rotaDayNight("Blue", "")).toBeNull();
    expect(rotaDayNight(undefined, "2026-11-14")).toBeNull();
  });
  it("a check done now belongs to the shift on, or the next today", () => {
    expect(currentDayNight("Blue", new Date(2026, 10, 9, 20))).toBe("Night");   // on nights
    expect(currentDayNight("Blue", new Date(2026, 10, 9, 15))).toBe("Night");   // nights later today
    expect(currentDayNight("Blue", new Date(2026, 10, 14, 9))).toBe("Day");
  });
});

// Blue Watch: Mon 16 Nov 2026 1st Night, Tue 17 2nd Night, then rest; Sun 22 1st Day.
describe("the board the Crewing page opens on", () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
  it("the night's own board until midnight", () => {
    expect(crewingBoardShiftFor("Blue", at(16, 23, 30))).toEqual({ shiftDate: "2026-11-16", shiftType: "1st Night", upcoming: false });
  });
  it("the next shift's board from midnight, while the night is still on", () => {
    expect(crewingBoardShiftFor("Blue", at(17, 0, 5))).toEqual({
      shiftDate: "2026-11-17", shiftType: "2nd Night", upcoming: true,
      running: { shiftDate: "2026-11-16", shiftType: "1st Night" },
    });
    // "Now" on Home and in alerts is still the night that's running.
    expect(crewingShiftFor("Blue", at(17, 6, 30))).toEqual({ shiftDate: "2026-11-16", shiftType: "1st Night", upcoming: false });
  });
  it("after the last night of a tour, the first day of the next", () => {
    expect(crewingBoardShiftFor("Blue", at(18, 6, 0))).toMatchObject({ shiftDate: "2026-11-22", shiftType: "1st Day", running: { shiftDate: "2026-11-17", shiftType: "2nd Night" } });
  });
  it("a day shift keeps its own board until 16:00, then the next shift's", () => {
    expect(crewingBoardShiftFor("Blue", at(14, 15, 59))).toEqual({ shiftDate: "2026-11-14", shiftType: "1st Day", upcoming: false });
    expect(crewingBoardShiftFor("Blue", at(14, 16, 0))).toEqual({
      shiftDate: "2026-11-15", shiftType: "2nd Day", upcoming: true,
      running: { shiftDate: "2026-11-14", shiftType: "1st Day" },
    });
    // After the 2nd Day, the next shift is that tour's 1st Night.
    expect(crewingBoardShiftFor("Blue", at(15, 16, 30))).toMatchObject({ shiftDate: "2026-11-16", shiftType: "1st Night", running: { shiftType: "2nd Day" } });
    // Once the day has finished there's nothing "still on duty".
    expect(crewingBoardShiftFor("Blue", at(14, 19, 0))).toEqual({ shiftDate: "2026-11-15", shiftType: "2nd Day", upcoming: true });
  });
  it("nothing on a rest day or with no rota", () => {
    expect(crewingBoardShiftFor("Blue", at(19, 12, 0))).toBeNull();
    expect(crewingBoardShiftFor(undefined)).toBeNull();
  });
});
