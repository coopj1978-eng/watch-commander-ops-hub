import { describe, expect, it } from "vitest";
import { DEFAULT_PEOPLE_FILTERS, openingFilters, parseSavedFilters, peopleFiltersKey } from "./peopleFilters";

const saved = JSON.stringify({ status: "active", watch: ["Blue"], rank: [], skills: ["BA"], driverPathway: "", station: "", sortBy: "name", sortDir: "desc" });

describe("People's opening filters", () => {
  it("opens on what this person last left it on", () => {
    expect(openingFilters(new URLSearchParams(""), saved)).toMatchObject({ status: "active", watch: ["Blue"], skills: ["BA"], sortBy: "name", sortDir: "desc" });
  });
  it("a link with its own filters wins", () => {
    expect(openingFilters(new URLSearchParams("watch=Red,Green"), saved)).toMatchObject({ status: "all", watch: ["Red", "Green"], skills: [] });
  });
  it("a search on its own isn't a filter", () => {
    expect(openingFilters(new URLSearchParams("search=andy"), saved).watch).toEqual(["Blue"]);
  });
  it("nothing saved, or something unreadable, is the default", () => {
    expect(openingFilters(new URLSearchParams(""), null)).toEqual(DEFAULT_PEOPLE_FILTERS);
    expect(parseSavedFilters("not json")).toBeNull();
    expect(parseSavedFilters(JSON.stringify({ status: "odd", watch: "Blue", sortDir: 3 }))).toEqual(DEFAULT_PEOPLE_FILTERS);
  });
  it("each person has their own", () => {
    expect(peopleFiltersKey("u1")).not.toBe(peopleFiltersKey("u2"));
  });
});
