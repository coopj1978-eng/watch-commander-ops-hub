import { describe, expect, it } from "vitest";
import { assigneeList } from "./taskAssign";

const person = (id: string, name: string, watch: string | null, extra: { left?: boolean; rank?: string; profileWatch?: string } = {}) => ({
  user: { id, name, watch_unit: watch, left_at: extra.left ? "2026-10-01" : null },
  profile: { watch: extra.profileWatch ?? null, rank: extra.rank ?? "Firefighter" },
});

describe("who a task can be given to", () => {
  const people = [
    person("r1", "Rory Red", "Red"),
    person("b2", "Bea Blue", "Blue"),
    person("a1", "Ann Amber", "Amber"),
    person("b1", "Al Blue", "Blue"),
  ];

  it("lists the task's own watch first, then the others by watch and name", () => {
    expect(assigneeList(people, "Blue")).toEqual([
      { id: "b1", name: "Al Blue", note: "" },
      { id: "b2", name: "Bea Blue", note: "" },
      { id: "a1", name: "Ann Amber", note: "Amber Watch" },
      { id: "r1", name: "Rory Red", note: "Red Watch" },
    ]);
  });

  it("leaves out people who have left and the admin-only account", () => {
    const r = assigneeList([...people, person("x", "Gone Person", "Blue", { left: true }), person("adm", "Station Admin", null, { rank: "Admin" })], "Blue");
    expect(r.map((p) => p.id)).toEqual(["b1", "b2", "a1", "r1"]);
  });

  it("uses the watch on the profile when the account has none, and says when there is none", () => {
    const r = assigneeList([person("p", "Pat Profile", null, { profileWatch: "Blue" }), person("n", "Nat None", null)], "blue");
    expect(r).toEqual([{ id: "p", name: "Pat Profile", note: "" }, { id: "n", name: "Nat None", note: "no watch" }]);
  });

  it("marks everyone with their watch when the task has no watch", () => {
    expect(assigneeList(people, "").every((p) => p.note.endsWith("Watch"))).toBe(true);
  });
});
