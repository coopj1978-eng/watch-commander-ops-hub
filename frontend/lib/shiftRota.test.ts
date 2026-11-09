import { describe, it, expect } from "vitest";
import { currentDayNight, rotaDayNight } from "./shiftRota";

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
