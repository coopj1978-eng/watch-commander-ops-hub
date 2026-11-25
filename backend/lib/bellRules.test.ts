import { describe, expect, it } from "vitest";
import { BELL_DAYS, bookingLoggedRings, certRings, overdueTaskRings } from "./bellRules";

describe("what rings the bell", () => {
  it("rings for an overdue task only when it was given to you", () => {
    expect(overdueTaskRings({ assigned_to_user_id: "me" }, "me")).toBe(true);
    expect(overdueTaskRings({ assigned_to_user_id: "someone" }, "me")).toBe(false);
    expect(overdueTaskRings({ assigned_to_user_id: null }, "me")).toBe(false); // a watch task: Home counts it
  });

  it("rings for your own certificate from 30 days out", () => {
    const me = { id: "me", is_wc_of_owner: false };
    expect(certRings({ owner_id: "me", days_left: 30 }, me)).toBe(true);
    expect(certRings({ owner_id: "me", days_left: -3 }, me)).toBe(true);
    expect(certRings({ owner_id: "me", days_left: 45 }, me)).toBe(false);
  });

  it("rings for the Watch Commander only once someone's certificate has expired", () => {
    const wc = { id: "wc", is_wc_of_owner: true };
    expect(certRings({ owner_id: "ff", days_left: 12 }, wc)).toBe(false);
    expect(certRings({ owner_id: "ff", days_left: -1 }, wc)).toBe(true);
    // not their watch
    expect(certRings({ owner_id: "ff", days_left: -1 }, { id: "wc", is_wc_of_owner: false })).toBe(false);
  });

  it("doesn't ring when a booking is logged, and keeps 30 days", () => {
    for (const t of ["toil", "orange_day", "training", "overtime", "flexi_payback"]) expect(bookingLoggedRings(t)).toBe(false);
    expect(BELL_DAYS).toBe(30);
  });
});
