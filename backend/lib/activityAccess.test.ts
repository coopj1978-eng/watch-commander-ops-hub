import { describe, it, expect } from "vitest";
import { canLogActivity } from "./activityAccess";

describe("who can log a target record", () => {
  it("WCs and CCs log anything, any watch", () => {
    expect(canLogActivity({ role: "WC", watchUnit: "Blue" }, { type: "community", watch: "Red" })).toBe(true);
    expect(canLogActivity({ role: "CC", watchUnit: "Blue" }, { type: "hydrant", watch: "Blue" })).toBe(true);
  });

  it("a firefighter fills in their own watch's HFSV visits", () => {
    expect(canLogActivity({ role: "FF", watchUnit: "Blue" }, { type: "hfsv", watch: "blue" })).toBe(true);
  });

  it("but not another watch's, nor community or hydrants", () => {
    expect(canLogActivity({ role: "FF", watchUnit: "Blue" }, { type: "hfsv", watch: "Red" })).toBe(false);
    expect(canLogActivity({ role: "FF", watchUnit: "Blue" }, { type: "community", watch: "Blue" })).toBe(false);
    expect(canLogActivity({ role: "FF", watchUnit: "Blue" }, { type: "hydrant", watch: "Blue" })).toBe(false);
  });

  it("no watch set, nothing to log", () => {
    expect(canLogActivity({ role: "FF", watchUnit: "" }, { type: "hfsv", watch: "" })).toBe(false);
  });
});
