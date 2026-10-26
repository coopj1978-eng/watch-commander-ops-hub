import { describe, it, expect } from "vitest";
import { countDays, rollingSickness } from "./sicknessMath";
import { watchShiftOn } from "./shiftRota";

// Blue Watch: 1st Day Mon 9 Mar 2026, so 21–24 Oct 2026 = day, day, night,
// night; 25–28 Oct rest; 29 Oct back on 1st Day.
const blueDuty = (iso: string) => {
  const s = watchShiftOn("Blue", iso);
  return s === "1st Day" || s === "2nd Day" || s === "1st Night" || s === "2nd Night";
};

describe("sickness counts duty days only", () => {
  it("counts every day without a rota", () => {
    expect(countDays("2026-10-21", "2026-10-30")).toBe(10);
  });

  it("counts only rostered shifts with a rota", () => {
    // 21–24 on, 25–28 rest, 29–30 on → 6 shifts in 10 days
    expect(countDays("2026-10-21", "2026-10-30", blueDuty)).toBe(6);
  });

  it("a long sickness counts the shifts missed, not the calendar days", () => {
    const rows = [{ start_date: "2026-10-01", end_date: "2026-10-26", returned_to_work_at: "2026-10-27" }];
    const all = rollingSickness(rows, "2026-10-27");
    const duty = rollingSickness(rows, "2026-10-27", blueDuty);
    expect(all).toEqual({ episodes: 1, days: 26 });
    expect(duty.episodes).toBe(1);
    expect(duty.days).toBeLessThan(26);
    expect(duty.days).toBe(countDays("2026-10-01", "2026-10-26", blueDuty));
  });

  it("sickness only on rest days isn't an episode", () => {
    const rows = [{ start_date: "2026-10-25", end_date: "2026-10-27", returned_to_work_at: "2026-10-28" }];
    expect(rollingSickness(rows, "2026-10-28", blueDuty)).toEqual({ episodes: 0, days: 0 });
  });
});
