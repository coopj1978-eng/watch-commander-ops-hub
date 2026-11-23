import { describe, expect, it } from "vitest";
import { stationPeople } from "./taskAssign";

const row = (id: string, name: string, watch: string, extra: { station?: string; rank?: string; left_at?: string } = {}) => ({
  user: { id, name, watch_unit: watch, left_at: extra.left_at },
  profile: { station: extra.station ?? "B10 Springburn", rank: extra.rank ?? "Firefighter", watch },
});

describe("stationPeople", () => {
  it("groups everyone at the station by watch, your own watch first", () => {
    const out = stationPeople([row("a", "Zoe", "Red"), row("b", "Andy", "Blue"), row("c", "Chris", "Red"), row("d", "Dee", "green")], "Blue");
    expect(out.map((g) => g.watch)).toEqual(["Blue", "Green", "Red"]);
    expect(out[2].people.map((p) => p.name)).toEqual(["Chris", "Zoe"]);
  });
  it("leaves out people at another station, who've left, and admin-only accounts", () => {
    const out = stationPeople([
      row("a", "Here", "Red"),
      row("b", "Moved", "Red", { station: "A01 Cowcaddens" }),
      row("c", "Gone", "Red", { left_at: "2026-10-01" }),
      row("d", "Admin", "", { rank: "Admin" }),
      row("e", "No station", "Red", { station: "" }),
    ], "Blue");
    expect(out.flatMap((g) => g.people.map((p) => p.name))).toEqual(["Here", "No station"]);
  });
  it("puts people with no watch last", () => {
    expect(stationPeople([row("a", "A", ""), row("b", "B", "Amber")], "Red").map((g) => g.watch)).toEqual(["Amber", ""]);
  });
});
