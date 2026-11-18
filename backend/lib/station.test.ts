import { describe, expect, it } from "vitest";
import { ADMIN_RANK, atHomeStation, HOME_STATION, onWatchHere, onWatchHereSql } from "./station";

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
});

describe("onWatchHere", () => {
  it("is crew at this station", () => {
    expect(onWatchHere(HOME_STATION, "Firefighter")).toBe(true);
    expect(onWatchHere(null, "Watch Commander")).toBe(true);
    expect(onWatchHere("", null)).toBe(true);
  });
  it("leaves out another station and an admin-only account", () => {
    expect(onWatchHere("B11 Easterhouse", "Watch Commander")).toBe(false);
    expect(onWatchHere(HOME_STATION, ADMIN_RANK)).toBe(false);
  });
  it("writes the same test for a query", () => {
    expect(onWatchHereSql("p")).toBe(
      "(COALESCE(NULLIF(TRIM(p.station), ''), 'B10 Springburn') = 'B10 Springburn' AND COALESCE(p.rank, '') <> 'Admin')"
    );
  });
});
