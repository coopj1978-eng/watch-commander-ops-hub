import { describe, it, expect } from "vitest";
import { slotAt, slotForWatch, ukInstant, watchForSlot } from "./shiftRota";

describe("shift slots (UK time)", () => {
  it("day shift runs 08:00–18:00 UK time in BST", () => {
    // 1 Jul 2026 07:30 UTC = 08:30 BST → day shift
    const s = slotAt(new Date("2026-07-01T07:30:00Z"));
    expect(s.type).toBe("day");
    expect(s.date).toBe("2026-07-01");
    expect(s.start.toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(s.end.toISOString()).toBe("2026-07-01T17:00:00.000Z");
  });

  it("before 08:00 is still the previous day's night shift", () => {
    // 1 Jul 2026 06:30 UTC = 07:30 BST
    const s = slotAt(new Date("2026-07-01T06:30:00Z"));
    expect(s.type).toBe("night");
    expect(s.date).toBe("2026-06-30");
    expect(s.end.toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });

  it("handles the night the clocks go back (25 Oct 2026)", () => {
    const s = slotAt(new Date("2026-10-25T03:00:00Z"));
    expect(s.type).toBe("night");
    expect(s.date).toBe("2026-10-24");
    expect(s.start.toISOString()).toBe("2026-10-24T17:00:00.000Z"); // 18:00 BST
    expect(s.end.toISOString()).toBe("2026-10-25T08:00:00.000Z");   // 08:00 GMT
  });

  it("ukInstant gives the UK wall-clock hour in winter", () => {
    expect(ukInstant("2026-12-01", 8).toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });

  it("finds a watch's next shift past its rest days", () => {
    // Sun 25 Oct 2026 10:00 GMT: Blue is on a rest day; next is 1st Day Thu 29 Oct.
    const s = slotForWatch("blue", new Date("2026-10-25T10:00:00Z"));
    expect(s?.onDuty).toBe(false);
    expect(s?.date).toBe("2026-10-29");
    expect(s?.type).toBe("day");
    expect(s?.label).toBe("1st Day");
  });

  it("the watch on duty is on its own shift", () => {
    const now = new Date("2026-10-25T10:00:00Z");
    const onDuty = watchForSlot(slotAt(now));
    expect(onDuty).not.toBeNull();
    const s = slotForWatch(onDuty!.watch, now);
    expect(s?.onDuty).toBe(true);
    expect(s?.date).toBe("2026-10-25");
  });
});
