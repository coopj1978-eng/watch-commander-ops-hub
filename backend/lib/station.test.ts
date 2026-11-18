import { describe, expect, it } from "vitest";
import { atHomeStation, atHomeStationSql, HOME_STATION } from "./station";

describe("atHomeStation", () => {
  it("counts this station, and a record with no station, as here", () => {
    expect(atHomeStation(HOME_STATION)).toBe(true);
    expect(atHomeStation("  B10 Springburn ")).toBe(true);
    expect(atHomeStation("")).toBe(true);
    expect(atHomeStation(null)).toBe(true);
    expect(atHomeStation(undefined)).toBe(true);
  });
  it("counts any other station as away", () => {
    expect(atHomeStation("B11 Easterhouse")).toBe(false);
    expect(atHomeStation("COG Training")).toBe(false);
  });
  it("writes the same test for a query", () => {
    expect(atHomeStationSql("p")).toBe("(COALESCE(NULLIF(TRIM(p.station), ''), 'B10 Springburn') = 'B10 Springburn')");
  });
});
