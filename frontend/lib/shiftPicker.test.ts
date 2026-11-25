import { describe, expect, it } from "vitest";
import { monthGrid, shiftPick } from "./shiftPicker";
import { getShiftForDate } from "./shiftRota";

describe("the month the shift picker draws", () => {
  it("is whole weeks, Monday first, with the days either side", () => {
    const g = monthGrid(2026, 10); // November 2026: the 1st is a Sunday
    expect(g[0]).toBe("2026-10-26");
    expect(g[6]).toBe("2026-11-01");
    expect(g[g.length - 1]).toBe("2026-12-06");
    expect(g.length % 7).toBe(0);
  });

  it("needs no spare week when the month starts on a Monday", () => {
    const g = monthGrid(2027, 1); // February 2027: 1st is a Monday, 28 days
    expect(g).toHaveLength(28);
    expect(g[0]).toBe("2027-02-01");
  });
});

describe("what can be picked", () => {
  // Walk a stretch of Blue Watch's rota and check every day against the rota itself.
  const days = Array.from({ length: 80 }, (_, i) => {
    const d = new Date(2026, 10, 1 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  it("lets you pick every shift and no rest day", () => {
    for (const iso of days) {
      const [y, m, d] = iso.split("-").map(Number);
      const s = getShiftForDate("Blue", new Date(y, m - 1, d))!;
      const p = shiftPick("Blue", iso);
      if (s.isWorking) expect(p).toMatchObject({ canPick: true, label: s.shiftType, kind: /Night/.test(s.shiftType) ? "night" : "day" });
      else expect(p.canPick).toBe(false);
    }
  });

  it("only lets you pick annual leave where the form allows it", () => {
    const leave = days.filter((iso) => shiftPick("Blue", iso).kind === "leave");
    expect(leave.length).toBeGreaterThan(0);
    for (const iso of leave) {
      expect(shiftPick("Blue", iso)).toMatchObject({ canPick: false, label: "Annual leave" });
      expect(shiftPick("Blue", iso, true).canPick).toBe(true);
    }
  });

  it("picks nothing for a watch with no rota", () => {
    expect(shiftPick("Purple", "2026-11-23")).toEqual({ iso: "2026-11-23", kind: null, label: "", canPick: false });
  });
});
