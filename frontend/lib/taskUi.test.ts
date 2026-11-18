import { describe, expect, it } from "vitest";
import { autoStatusFor, rewordLine } from "./taskUi";

const cols = ["NotStarted", "InProgress", "Done", "Notes_1"];
const items = (...done: boolean[]) => done.map((d, i) => ({ label: `i${i}`, done: d }));

describe("autoStatusFor", () => {
  it("leaves a card where it is while it's being ticked — In Progress is set by hand", () => {
    expect(autoStatusFor("NotStarted", items(true, false), cols)).toBeNull();
    expect(autoStatusFor("InProgress", items(true, false), cols)).toBeNull();
    expect(autoStatusFor("InProgress", items(false, false), cols)).toBeNull();
  });
  it("moves it to Done on the last tick, from To Do or In Progress", () => {
    expect(autoStatusFor("InProgress", items(true, true), cols)).toBe("Done");
    expect(autoStatusFor("NotStarted", items(true), cols)).toBe("Done");
  });
  it("puts a Done card back in To Do when something is unticked", () => {
    expect(autoStatusFor("Done", items(true, false), cols)).toBe("NotStarted");
  });
  it("leaves custom columns, empty checklists and missing columns alone", () => {
    expect(autoStatusFor("Notes_1", items(true, true), cols)).toBeNull();
    expect(autoStatusFor("NotStarted", [], cols)).toBeNull();
    expect(autoStatusFor("NotStarted", items(true, true), ["NotStarted", "InProgress"])).toBeNull();
  });
});

describe("rewordLine", () => {
  const lines = ["Pump test", "BA sets", "Radios"];
  it("changes just that line, tidied", () => {
    expect(rewordLine(lines, 1, "  BA sets  1029 and 1032 ")).toEqual({ labels: ["Pump test", "BA sets 1029 and 1032", "Radios"] });
  });
  it("leaves it alone when blank or unchanged", () => {
    expect(rewordLine(lines, 1, "   ")).toEqual({ skip: "same" });
    expect(rewordLine(lines, 1, "BA sets")).toEqual({ skip: "same" });
    expect(rewordLine(lines, 9, "x")).toEqual({ skip: "same" });
  });
  it("lets a line change its capitals but not copy another line", () => {
    expect(rewordLine(lines, 1, "BA Sets")).toEqual({ labels: ["Pump test", "BA Sets", "Radios"] });
    expect(rewordLine(lines, 1, "radios")).toEqual({ skip: "duplicate" });
  });
});
