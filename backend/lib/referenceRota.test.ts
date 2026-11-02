import { describe, expect, it } from "vitest";
import { lastTourStart, referenceCardPeriod, referenceCardPlan, referenceHolders } from "./referenceRota";
import { ukInstant } from "./shiftRota";

describe("reference rota (server)", () => {
  it("matches the planner for 2026–27", () => {
    expect(referenceHolders(1, 2026)).toEqual({ main: "Red", secondary: "White" });
    expect(referenceHolders(2, 2027)).toEqual({ main: "Amber", secondary: "Red" });
    expect(referenceHolders(4, 2026)).toEqual({ main: "Blue", secondary: "Green" });
    expect(referenceHolders(4, 2028)).toEqual({ main: "Green", secondary: "Amber" });
  });

  it("works out the period a card covers", () => {
    expect(referenceCardPeriod("monthly", "2026-11-02")).toEqual({ start: "2026-11-01", endDate: "2026-12-01" });
    expect(referenceCardPeriod("monthly", "2026-12-31")).toEqual({ start: "2026-12-01", endDate: "2027-01-01" });
    expect(referenceCardPeriod("quarterly", "2026-11-02")).toEqual({ start: "2026-10-01", endDate: "2027-01-01" });
    expect(referenceCardPeriod("quarterly", "2027-02-14")).toEqual({ start: "2027-01-01", endDate: "2027-04-01" });
    expect(referenceCardPeriod("annual", "2026-11-02")).toEqual({ start: "2026-01-01", endDate: "2027-01-01" });
  });

  it("finds the 1st Day of a watch's last tour in a period", () => {
    // Blue's November tours start 6, 14 and 22 Nov (then leave to 13 Dec).
    expect(lastTourStart("Blue", { start: "2026-11-01", endDate: "2026-12-01" })).toBe("2026-11-22");
    // Their last tour of 2026 starts 30 Dec and runs into January.
    expect(lastTourStart("Blue", { start: "2026-10-01", endDate: "2027-01-01" })).toBe("2026-12-30");
  });

  it("brings each card up on the main watch's last tour, due when its 2nd Night ends", () => {
    expect(referenceCardPlan(4, "monthly", "2026-11-02")).toEqual({
      period: { start: "2026-11-01", endDate: "2026-12-01" }, watch: "Blue", tourStart: "2026-11-22", due: ukInstant("2026-11-26", 8),
    });
    const annual = referenceCardPlan(4, "annual", "2026-11-02")!;
    expect([annual.watch, annual.tourStart, annual.due]).toEqual(["Blue", "2026-12-30", ukInstant("2027-01-03", 8)]);
    // A period's card is for that year's holder: Blue's 2027 annual card,
    // Green's from January 2028 when the references move on.
    expect(referenceCardPlan(4, "annual", "2027-06-01")!.watch).toBe("Blue");
    expect(referenceCardPlan(4, "monthly", "2028-01-05")!.watch).toBe("Green");
  });
});
