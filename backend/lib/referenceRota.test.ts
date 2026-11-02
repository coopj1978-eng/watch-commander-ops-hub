import { describe, expect, it } from "vitest";
import { referenceCardOwner, referenceCardPeriod, referenceHolders } from "./referenceRota";

describe("reference rota (server)", () => {
  it("matches the planner for 2026–27", () => {
    expect(referenceHolders(1, 2026)).toEqual({ main: "Red", secondary: "White" });
    expect(referenceHolders(2, 2027)).toEqual({ main: "Amber", secondary: "Red" });
    expect(referenceHolders(4, 2026)).toEqual({ main: "Blue", secondary: "Green" });
    expect(referenceHolders(4, 2028)).toEqual({ main: "Green", secondary: "Amber" });
  });

  it("works out the period a card covers", () => {
    expect(referenceCardPeriod("monthly", null, "2026-11-02")).toEqual({ start: "2026-11-01", endDate: "2026-12-01" });
    expect(referenceCardPeriod("monthly", null, "2026-12-31")).toEqual({ start: "2026-12-01", endDate: "2027-01-01" });
    expect(referenceCardPeriod("quarterly", null, "2026-11-02")).toEqual({ start: "2026-10-01", endDate: "2027-01-01" });
    expect(referenceCardPeriod("quarterly", null, "2027-02-14")).toEqual({ start: "2027-01-01", endDate: "2027-04-01" });
    expect(referenceCardPeriod("annual", 1, "2026-11-02")).toEqual({ start: "2026-01-01", endDate: "2027-01-01" });
    expect(referenceCardPeriod("annual", 3, "2027-02-01")).toBeNull();
    expect(referenceCardPeriod("annual", 3, "2027-03-05")).toEqual({ start: "2027-03-01", endDate: "2028-01-01" });
  });

  it("gives the card to the main watch, or the secondary only when the main watch has no shift left", () => {
    expect(referenceCardOwner(4, 2026, "Blue", true)).toBe("Blue");
    expect(referenceCardOwner(4, 2026, "Blue", false)).toBe("Blue");
    expect(referenceCardOwner(4, 2026, "Green", true)).toBeNull();   // Blue can still do it
    expect(referenceCardOwner(4, 2026, "Green", false)).toBe("Green");
    expect(referenceCardOwner(4, 2026, "Red", false)).toBeNull();
  });
});
