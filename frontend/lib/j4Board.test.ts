import { describe, expect, it } from "vitest";
import { boardGroups, boardLine, boardSummary, outstanding, type BoardDefect } from "./j4Board";

const base: BoardDefect = {
  id: 1,
  defect_type: "appliance",
  appliance_id: 1,
  equipment_item_id: null,
  appliance_call_sign: "B10P1",
  equipment_name: "",
  title: "Tool box",
  description: "Replacement ordered",
  location: null,
  status: "Ordered",
  j7_raised: false,
  watch: "Blue",
  reported_at: "2026-10-22T12:00:00Z",
  reported_by_name: "A Person",
  overdue: false,
};
const appliances = [
  { id: 2, call_sign: "B10P2", name: "2nd pump" },
  { id: 1, call_sign: "B10P1", name: "1st pump" },
];

describe("boardLine", () => {
  it("a typed-in item: the title is the item, the detail is the remarks", () => {
    expect(boardLine(base)).toMatchObject({ item: "Tool box", remarks: "Replacement ordered", status: "Ordered", watch: "Blue", j7: false });
  });

  it("kit from the list: the kit is the item, title and detail are the remarks", () => {
    const line = boardLine({ ...base, defect_type: "equipment", equipment_name: "BA Set 1030", title: "Missing", description: "Not on the pump at 0800" });
    expect(line.item).toBe("BA Set 1030");
    expect(line.remarks).toBe("Missing. Not on the pump at 0800");
  });

  it("a line made by a J4 check has no title", () => {
    const line = boardLine({ ...base, defect_type: "equipment", equipment_name: "13.5m ladder", title: null, description: "Item marked as Missing during J4 check", status: "Open" });
    expect(line).toMatchObject({ item: "13.5m ladder", remarks: "Item marked as Missing during J4 check", status: "Open" });
  });

  it("station: the place goes into the remarks", () => {
    const line = boardLine({ ...base, defect_type: "station", appliance_id: null, title: "Bay door", location: "Bay 2", description: "Sticks half way" });
    expect(line.item).toBe("Bay door");
    expect(line.remarks).toBe("Bay 2. Sticks half way");
  });

  it("blank watch reads as none", () => {
    expect(boardLine({ ...base, watch: " " }).watch).toBeNull();
  });
});

describe("boardGroups", () => {
  const defects: BoardDefect[] = [
    { ...base, id: 3 },
    { ...base, id: 1, title: "Electrical gauntlets", description: "Test expired", status: "Open", reported_at: "2026-09-27T12:00:00Z", watch: "Red" },
    { ...base, id: 4, defect_type: "station", appliance_id: null, appliance_call_sign: "", title: "Boiler", description: "No hot water" },
  ];

  it("one column per appliance in call-sign order, empty ones included, station last", () => {
    const groups = boardGroups(appliances, defects);
    expect(groups.map((g) => g.heading)).toEqual(["B10P1", "B10P2", "Station"]);
    expect(groups[1].lines).toEqual([]);
  });

  it("oldest line first in a column", () => {
    expect(boardGroups(appliances, defects)[0].lines.map((l) => l.item)).toEqual(["Electrical gauntlets", "Tool box"]);
  });

  it("no station column when the station has nothing", () => {
    expect(boardGroups(appliances, defects.slice(0, 2)).map((g) => g.heading)).toEqual(["B10P1", "B10P2"]);
  });

  it("a line for an appliance that's been taken off keeps a column", () => {
    const groups = boardGroups(appliances, [{ ...base, appliance_id: 9, appliance_call_sign: "B10T1" }]);
    expect(groups.map((g) => g.heading)).toEqual(["B10P1", "B10P2", "B10T1"]);
    expect(groups[2].lines).toHaveLength(1);
  });

  it("summary line", () => {
    expect(boardSummary(boardGroups(appliances, defects))).toBe("2 on B10P1 · 1 on the station");
    expect(boardSummary(boardGroups(appliances, []))).toBe("");
  });
});

describe("outstanding", () => {
  it("open and ordered stay on the board; resolved comes off", () => {
    expect(["Open", "Ordered", "Resolved"].map((status) => outstanding({ status }))).toEqual([true, true, false]);
  });
});
