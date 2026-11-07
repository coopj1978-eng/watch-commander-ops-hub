import { describe, expect, it } from "vitest";
import { describeShort, riderQuals, seatCheck, type RiderQuals } from "./ridingSeats";

const ba: RiderQuals = { oic: false, driver: false, ba: true };
const driver: RiderQuals = { oic: false, driver: true, ba: true };
const officer: RiderQuals = { oic: true, driver: false, ba: true };
const many = (n: number, q: RiderQuals) => Array.from({ length: n }, () => q);

describe("riding seats", () => {
  it("rides both pumps with 2 OIC, 2 drivers and 5 BA", () => {
    expect(seatCheck([...many(2, officer), ...many(2, driver), ...many(5, ba)])).toEqual({ pumps: 2, short: [] });
  });

  it("is short for both pumps with nine people but only one driver", () => {
    const r = seatCheck([...many(2, officer), driver, ...many(6, ba)]);
    expect(r.pumps).toBe(1);
    expect(describeShort(r.short)).toBe("1 driver");
  });

  it("can't ride a pump with no OIC, however many there are", () => {
    const r = seatCheck([...many(2, driver), ...many(8, ba)]);
    expect(r.pumps).toBe(0);
    expect(describeShort(r.short)).toBe("1 OIC");
  });

  it("moves someone over when that frees the only person for a seat", () => {
    // The only driver is also an OIC; a second OIC lets them drive.
    const oicDriver: RiderQuals = { oic: true, driver: true, ba: true };
    expect(seatCheck([oicDriver, officer, ...many(3, ba)]).pumps).toBe(1);
  });

  it("names BA seats as short when it's only heads that are missing", () => {
    const r = seatCheck([...many(2, officer), ...many(2, driver), ...many(3, ba)]);
    expect(r.pumps).toBe(1);
    expect(describeShort(r.short)).toBe("2 BA");
  });

  it("treats a Watch or Crew Commander as able to take charge", () => {
    expect(riderQuals({ role: "CC", ba: true }).oic).toBe(true);
    expect(riderQuals({ role: "FF", rank: "Watch Commander" }).oic).toBe(true);
    expect(riderQuals({ role: "FF", ba: true }).oic).toBe(false);
  });

  it("lists several needs together", () => {
    const r = seatCheck([officer, ...many(2, ba)]);
    expect(r.pumps).toBe(0);
    expect(describeShort(r.short)).toBe("1 driver and 1 BA");
  });
});
