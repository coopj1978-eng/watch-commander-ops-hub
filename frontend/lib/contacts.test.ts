import { describe, expect, it } from "vitest";
import { groupContacts, matches, sectionNames, splitNumbers, type ContactLine } from "./contacts";

const line = (over: Partial<ContactLine>): ContactLine => ({
  id: 1, section: "Control and staffing", name: "Control", detail: null, numbers: "3999", note: null, position: 1, ...over,
});

describe("splitNumbers", () => {
  it("a full number can be called; an extension can't", () => {
    expect(splitNumbers("3999 / 01505 000000")).toEqual([
      { text: "3999", tel: null },
      { text: "01505 000000", tel: "01505000000" },
    ]);
  });

  it("mobiles, 0303 and 0844 numbers are callable", () => {
    expect(splitNumbers("07000 000000")[0].tel).toBe("07000000000");
    expect(splitNumbers("0303 001 0000")[0].tel).toBe("03030010000");
    expect(splitNumbers("0844 800 0000")[0].tel).toBe("08448000000");
    expect(splitNumbers("+44 7000 000000")[0].tel).toBe("+447000000000");
  });

  it("a local number with no code is shown, not linked", () => {
    expect(splitNumbers("553 0000")).toEqual([{ text: "553 0000", tel: null }]);
  });

  it("splits on commas and semicolons too, and drops blanks", () => {
    expect(splitNumbers("2500, 2505; ").map((p) => p.text)).toEqual(["2500", "2505"]);
  });
});

describe("matches", () => {
  const l = line({ name: "B10 Springburn", section: "Station direct lines", numbers: "0303 001 0000", detail: "Watch office" });

  it("by name, heading, what it's for, or number — spaces don't matter", () => {
    expect(matches(l, "spring")).toBe(true);
    expect(matches(l, "direct")).toBe(true);
    expect(matches(l, "watch office")).toBe(true);
    expect(matches(l, "0303001")).toBe(true);
    expect(matches(l, "b 10")).toBe(true);
    expect(matches(l, "govan")).toBe(false);
  });

  it("an empty search matches everything", () => {
    expect(matches(l, "  ")).toBe(true);
  });
});

describe("groupContacts", () => {
  const lines = [
    line({ id: 3, section: "Stations", name: "B02", position: 5 }),
    line({ id: 1, section: "Control and staffing", name: "Control", position: 1 }),
    line({ id: 2, section: "Stations", name: "B01", position: 4 }),
    line({ id: 4, section: "control and staffing", name: "Central Staffing", position: 2 }),
  ];

  it("sections in the order their first line sits; lines in order inside", () => {
    const g = groupContacts(lines);
    expect(g.map((s) => s.section)).toEqual(["Control and staffing", "Stations"]);
    expect(g[0].lines.map((l) => l.name)).toEqual(["Control", "Central Staffing"]);
    expect(g[1].lines.map((l) => l.name)).toEqual(["B01", "B02"]);
  });

  it("a search keeps only the sections with a match", () => {
    const g = groupContacts(lines, "b02");
    expect(g).toHaveLength(1);
    expect(g[0].lines.map((l) => l.name)).toEqual(["B02"]);
  });

  it("section names for the add form", () => {
    expect(sectionNames(lines)).toEqual(["Control and staffing", "Stations"]);
  });
});
