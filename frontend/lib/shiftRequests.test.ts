import { describe, it, expect } from "vitest";
import { csvCell, requestsCsv, signedAs } from "./shiftRequests";

describe("the records download", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell('a, "b"')).toBe('"a, ""b"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("stops a typed comment running as a formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-1")).toBe("'-1");
  });

  it("leaves blanks blank", () => {
    expect(csvCell(null)).toBe("");
  });

  it("writes a row under the headings", () => {
    const csv = requestsCsv([{
      id: 7, type: "flexi", status: "approved", user_name: "Alex Morgan", user_role: "FF", payroll_number: "123", station: "B10",
      watch: "Blue", shift_date: "2026-11-20", shift_type: "1st Day", created_at: "2026-11-05T10:00:00Z", cover_name: null,
      cover_payroll: null, cover_station: null, cover_watch: null, decided_by_name: "J Cooper", decided_by_role: "WC",
      decided_at: "2026-11-05T12:00:00Z", pinch_point: "green", over_limit_agreed: false, sc_endorsed: false,
      wc_comments: null, outcome_at: null, outcome_by_name: null, payback_date: null, payback_day_night: null,
    } as never]);
    const [head, row] = csv.split("\r\n");
    expect(head.startsWith("Ref,Type,Name")).toBe(true);
    expect(row.startsWith("7,Flexi Day,Alex Morgan,FF,123,B10,Blue,2026-11-20,1st Day,2026-11-05,Approved")).toBe(true);
    expect(row).toContain("J Cooper (WC)");
  });
});

describe("who signed", () => {
  it("says a CC signed because the WC was off", () => {
    expect(signedAs({ decided_by_name: "C", decided_by_role: "CC" })).toBe("C (CC, WC off)");
    expect(signedAs({ decided_by_name: "W", decided_by_role: "WC" })).toBe("W (WC)");
  });
});
