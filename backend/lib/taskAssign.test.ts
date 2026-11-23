import { describe, expect, it } from "vitest";
import { assignRefusal, assignedNote } from "./taskAssign";

describe("assignRefusal", () => {
  const ff = { userID: "ff1", role: "FF" };
  it("lets a WC, a CC or the admin give a task to anyone", () => {
    expect(assignRefusal({ userID: "wc", role: "WC" }, "ff1")).toBeNull();
    expect(assignRefusal({ userID: "cc", role: "CC" }, "ff1")).toBeNull();
    expect(assignRefusal({ userID: "a", role: "FF", isAdmin: true }, "ff2")).toBeNull();
  });
  it("lets anyone take a task themselves or hand it back", () => {
    expect(assignRefusal(ff, "ff1")).toBeNull();
    expect(assignRefusal(ff, null)).toBeNull();
  });
  it("stops a firefighter giving a task to someone else", () => {
    expect(assignRefusal(ff, "ff2")).toMatch(/Watch or Crew Commander/);
  });
});

describe("assignedNote", () => {
  it("says who and when it's due", () => {
    expect(assignedNote({ title: "Clean BA sets", due_at: "2026-11-24T08:00:00Z" }, "Andy Jones"))
      .toBe('Andy Jones gave you "Clean BA sets", due Tue 24 Nov.');
  });
  it("leaves the date out when there isn't one", () => {
    expect(assignedNote({ title: "Hydrants", due_at: null }, null)).toBe('A commander gave you "Hydrants".');
  });
});
