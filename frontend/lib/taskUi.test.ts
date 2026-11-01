import { describe, expect, it } from "vitest";
import { autoStatusFor } from "./taskUi";

const cols = ["NotStarted", "InProgress", "Done", "Notes_1"];
const items = (...done: boolean[]) => done.map((d, i) => ({ label: `i${i}`, done: d }));

describe("autoStatusFor", () => {
  it("moves a To Do card to In Progress on the first tick", () => {
    expect(autoStatusFor("NotStarted", items(true, false), cols)).toBe("InProgress");
  });
  it("moves it to Done on the last tick, from To Do or In Progress", () => {
    expect(autoStatusFor("InProgress", items(true, true), cols)).toBe("Done");
    expect(autoStatusFor("NotStarted", items(true), cols)).toBe("Done");
  });
  it("puts a Done card back in progress when something is unticked", () => {
    expect(autoStatusFor("Done", items(true, false), cols)).toBe("InProgress");
  });
  it("leaves custom columns, empty checklists and missing columns alone", () => {
    expect(autoStatusFor("Notes_1", items(true, true), cols)).toBeNull();
    expect(autoStatusFor("NotStarted", [], cols)).toBeNull();
    expect(autoStatusFor("NotStarted", items(true, false), ["NotStarted", "Done"])).toBeNull();
    expect(autoStatusFor("InProgress", items(true, false), cols)).toBeNull();
  });
});
