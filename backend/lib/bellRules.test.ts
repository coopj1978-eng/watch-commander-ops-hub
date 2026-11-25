import { describe, expect, it } from "vitest";
import { BELL_DAYS, NO_EXTRAS, certRings, overdueTaskRings } from "./bellRules";

describe("what always rings", () => {
  it("rings for an overdue task given to you, whatever your switches", () => {
    expect(overdueTaskRings({ assigned_to_user_id: "me" }, "me")).toBe(true);
    expect(overdueTaskRings({ assigned_to_user_id: "me" }, "me", NO_EXTRAS)).toBe(true);
  });

  it("rings for your own certificate from 30 days out", () => {
    const me = { id: "me", is_wc_of_owner: false };
    expect(certRings({ owner_id: "me", days_left: 30 }, me)).toBe(true);
    expect(certRings({ owner_id: "me", days_left: -3 }, me)).toBe(true);
    expect(certRings({ owner_id: "me", days_left: 45 }, me)).toBe(false);
  });

  it("rings for the Watch Commander once someone's certificate has expired", () => {
    expect(certRings({ owner_id: "ff", days_left: -1 }, { id: "wc", is_wc_of_owner: true })).toBe(true);
    // not their watch
    expect(certRings({ owner_id: "ff", days_left: -1 }, { id: "wc", is_wc_of_owner: false })).toBe(false);
  });
});

describe("the extras: off until switched on", () => {
  it("leaves the watch's other overdue tasks quiet by default", () => {
    expect(overdueTaskRings({ assigned_to_user_id: null }, "me")).toBe(false);
    expect(overdueTaskRings({ assigned_to_user_id: "someone" }, "me")).toBe(false);
    expect(overdueTaskRings({ assigned_to_user_id: null }, "me", { ...NO_EXTRAS, watch_tasks: true })).toBe(true);
  });

  it("tells a WC or CC about certificates expiring soon only if they ask", () => {
    const soon = { owner_id: "ff", days_left: 12 };
    const wc = { id: "wc", is_wc_of_owner: true };
    const cc = { id: "cc", is_wc_of_owner: false, manages_owner: true };
    const on = { ...NO_EXTRAS, certs_soon: true };
    expect(certRings(soon, wc)).toBe(false);
    expect(certRings(soon, wc, on)).toBe(true);
    expect(certRings(soon, cc, on)).toBe(true);
    expect(certRings({ owner_id: "ff", days_left: 60 }, wc, on)).toBe(false);
    // a firefighter switching it on doesn't get anyone else's
    expect(certRings(soon, { id: "ff2", is_wc_of_owner: false }, on)).toBe(false);
  });

  it("keeps 30 days and starts with everything extra off", () => {
    expect(BELL_DAYS).toBe(30);
    expect(NO_EXTRAS).toEqual({ watch_tasks: false, certs_soon: false, bookings: false });
  });
});
