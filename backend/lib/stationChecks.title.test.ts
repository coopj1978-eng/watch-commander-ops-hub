import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({ default: {} }));
vi.mock("encore.dev/log", () => ({ default: { info: () => {}, error: () => {} } }));

const { fillTitle } = await import("./stationChecks");

describe("station check titles", () => {
  it("fills {date} with the day", () => {
    expect(fillTitle("Morning Drill — {date}", "2026-11-02", "day", false)).toBe("Morning Drill — Mon 2 Nov");
  });
  it("fills {shift} for every-shift checks", () => {
    expect(fillTitle("Appliance check {shift} {date}", "2026-11-02", "night", true)).toBe("Appliance check Night Mon 2 Nov");
  });
  it("leaves plain titles alone", () => {
    expect(fillTitle("Every Shift ", "2026-11-02", "day", false)).toBe("Every Shift");
  });
});
