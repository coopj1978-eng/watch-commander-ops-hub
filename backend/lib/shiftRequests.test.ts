import { describe, it, expect } from "vitest";
import {
  canDecide, canRecordOutcome, canViewRequest, findClashes, flexiChecks, h4hChecks, kronosDeadline, missingSkills,
  recommendedH4H, rotaFor, type Quals,
} from "./shiftRequests";

// Blue Watch: 21–24 Oct 2026 = 1st Day, 2nd Day, 1st Night, 2nd Night; 25–28
// Oct rest; 29 Oct back on 1st Day (see sicknessMath.test.ts).
const noQuals: Quals = { oic: false, ba: false, prps: false, driver_lgv: false, driver_erd: false, mass_decon: false, hooklift_operator: false };
const limits = { per_year: 4, days_ahead: 30, notice_hours: 48 };

describe("the rota", () => {
  it("reads Blue's shifts", () => {
    expect(rotaFor("Blue", "2026-10-21")).toMatchObject({ working: true, dayNight: "Day", label: "1st Day" });
    expect(rotaFor("Blue", "2026-10-23")).toMatchObject({ working: true, dayNight: "Night" });
    expect(rotaFor("Blue", "2026-10-26")).toMatchObject({ working: false, dayNight: null });
  });
});

describe("shift clashes", () => {
  it("finds nothing on a clear rest day", () => {
    expect(findClashes({ watch: "Blue", date: "2026-10-26", dayNight: "Day", commitments: [] })).toEqual([]);
  });

  it("flags being on duty with their own watch", () => {
    const c = findClashes({ watch: "Blue", date: "2026-10-21", dayNight: "Day", commitments: [] });
    expect(c[0]).toMatchObject({ kind: "same_shift", firm: true });
    expect(c[0].text).toContain("their own 1st Day");
  });

  it("flags an orange day they'd forgotten about", () => {
    const c = findClashes({
      watch: "Blue", date: "2026-10-26", dayNight: "Day",
      commitments: [{ date: "2026-10-26", dayNight: "Day", what: "an Orange Day", firm: true }],
    });
    expect(c[0].kind).toBe("same_shift");
    expect(c[0].text).toContain("Orange Day");
  });

  it("flags another head for head that shift", () => {
    const c = findClashes({
      watch: "Blue", date: "2026-10-26", dayNight: "Night",
      commitments: [{ date: "2026-10-26", dayNight: "Night", what: "a Head for Head", firm: true }],
    });
    expect(c[0].text).toContain("Head for Head");
  });

  it("flags agreeing a night with a day shift the next morning", () => {
    // Blue's 1st Day is 29 Oct; a night on the 28th ends as it starts.
    const c = findClashes({ watch: "Blue", date: "2026-10-28", dayNight: "Night", commitments: [] });
    expect(c).toHaveLength(1);
    expect(c[0].kind).toBe("runs_into");
    expect(c[0].text).toContain("1st Day starts at 08:00");
  });

  it("flags a day straight after their own night", () => {
    // Blue's 2nd Night is 24 Oct, finishing 08:00 on the 25th.
    const c = findClashes({ watch: "Blue", date: "2026-10-25", dayNight: "Day", commitments: [] });
    expect(c[0].kind).toBe("runs_into");
    expect(c[0].text).toContain("finishes at 08:00");
  });

  it("doesn't flag a day shift with a clear night before and day after", () => {
    expect(findClashes({ watch: "Blue", date: "2026-10-27", dayNight: "Day", commitments: [] })).toEqual([]);
  });

  it("ignores their own shift when they're booked off it", () => {
    expect(findClashes({
      watch: "Blue", date: "2026-10-21", dayNight: "Day", commitments: [], offDates: new Set(["2026-10-21"]),
    })).toEqual([]);
  });

  it("an older booking with no Day/Night counts for both", () => {
    const c = findClashes({
      watch: null, date: "2026-10-26", dayNight: "Night",
      commitments: [{ date: "2026-10-26", dayNight: null, what: "a Head for Head", firm: true }],
    });
    expect(c.length).toBe(1);
    expect(c[0].kind).toBe("same_shift");
  });

  it("a request nobody's approved yet isn't firm", () => {
    const c = findClashes({
      watch: null, date: "2026-10-26", dayNight: "Day",
      commitments: [{ date: "2026-10-26", dayNight: "Day", what: "another Head for Head request", firm: false }],
    });
    expect(c[0].firm).toBe(false);
  });
});

describe("skills", () => {
  it("lists what the cover doesn't have", () => {
    expect(missingSkills({ ...noQuals, ba: true, driver_lgv: true }, { ...noQuals, ba: true })).toEqual(["LGV"]);
  });
  it("having more than the person they cover is fine", () => {
    expect(missingSkills({ ...noQuals, ba: true }, { ...noQuals, ba: true, oic: true })).toEqual([]);
  });
});

describe("flexi checks", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const base = { watch: "Blue", date: "2026-10-21", dayNight: "Day" as const, now, limits, used: 0, events: [] };
  const of = (checks: ReturnType<typeof flexiChecks>, key: string) => checks.find((c) => c.key === key)!;

  it("passes a good request", () => {
    const c = flexiChecks(base);
    expect(of(c, "working_shift").state).toBe("ok");
    expect(of(c, "timing").state).toBe("ok");
    expect(of(c, "balance").detail).toContain("1 of 4");
  });

  it("blocks a rest day", () => {
    const c = of(flexiChecks({ ...base, date: "2026-10-26" }), "working_shift");
    expect(c.state).toBe("fail");
    expect(c.blocks).toBe(true);
  });

  it("blocks more than 30 days ahead", () => {
    const c = of(flexiChecks({ ...base, date: "2026-11-20" }), "timing");
    expect(c.blocks).toBe(true);
    expect(c.detail).toContain("limit");
  });

  it("blocks under 48 hours' notice", () => {
    const c = of(flexiChecks({ ...base, now: new Date("2026-10-20T12:00:00Z") }), "timing");
    expect(c.blocks).toBe(true);
    expect(c.detail).toContain("48");
  });

  it("warns when the Kronos deadline is close", () => {
    expect(of(flexiChecks({ ...base, now: new Date("2026-10-18T12:00:00Z") }), "timing").state).toBe("warn");
  });

  it("flags going over 4 but doesn't block it", () => {
    const c = of(flexiChecks({ ...base, used: 4 }), "balance");
    expect(c.state).toBe("fail");
    expect(c.blocks).toBeUndefined();
    expect(c.detail).toContain("SC endorsement");
  });

  it("marks crew numbers as managers only and grades them", () => {
    const crew = (available: number) => of(flexiChecks({ ...base, crew: { available, total: 10, rideOne: 5, rideBoth: 9 } }), "crew");
    expect(crew(9)).toMatchObject({ state: "ok", managersOnly: true });
    expect(crew(8).state).toBe("warn");
    expect(crew(4).state).toBe("fail");
  });

  it("warns when the seats left can't be filled", () => {
    const skills = (pumps: number, short: string) => of(flexiChecks({ ...base, skillsLeft: { oic: 2, drivers: 1, ba: 7, pumps, short } }), "skills");
    expect(skills(2, "").state).toBe("ok");
    expect(skills(1, "1 driver")).toMatchObject({ state: "warn", detail: expect.stringContaining("Both pumps would be short of 1 driver") });
    expect(skills(0, "1 OIC")).toMatchObject({ state: "fail", detail: expect.stringContaining("B10P1 would be short of 1 OIC") });
  });

  it("shows events that shift", () => {
    expect(of(flexiChecks({ ...base, events: ["Area exercise"] }), "events").state).toBe("warn");
  });

  it("puts the Kronos deadline 48 hours before the shift, in UK time", () => {
    expect(kronosDeadline("2026-10-21", "Day", 48).toISOString()).toBe("2026-10-19T07:00:00.000Z"); // BST
    expect(kronosDeadline("2026-11-20", "Night", 48).toISOString()).toBe("2026-11-18T18:00:00.000Z"); // GMT
  });
});

describe("head for head checks", () => {
  const cover = (over = {}) => ({
    name: "Cover", watch: "Blue", quals: { ...noQuals, ba: true }, commitments: [], offDates: new Set<string>(), ...over,
  });
  // White's rota is checked for the applicant; Blue is on rest 26–27 Oct.
  const base = {
    watch: "Blue", date: "2026-10-27", dayNight: "Day" as const, applicantName: "Applicant",
    applicantQuals: { ...noQuals, ba: true }, coverName: "Cover",
  };
  const of = (checks: ReturnType<typeof h4hChecks>, key: string) => checks.find((c) => c.key === key)!;

  it("blocks swapping a rest day", () => {
    expect(of(h4hChecks({ ...base, cover: cover() }), "applicant_shift").blocks).toBe(true);
  });

  it("allows an annual leave date, one request a shift", () => {
    expect(of(h4hChecks({ ...base, date: "2026-10-01", cover: null }), "applicant_shift").state).toBe("info");
  });

  it("recommends Authorised with a clear cover and matching skills", () => {
    const c = h4hChecks({ ...base, date: "2026-10-21", cover: cover({ watch: null }) });
    expect(of(c, "cover_clash").state).toBe("ok");
    expect(recommendedH4H(c)).toBe("authorised");
  });

  it("recommends Referred when the skills don't match", () => {
    const c = h4hChecks({ ...base, date: "2026-10-21", applicantQuals: { ...noQuals, driver_lgv: true }, cover: cover({ watch: null }) });
    expect(of(c, "skills_match").state).toBe("warn");
    expect(recommendedH4H(c)).toBe("referred");
  });

  it("recommends Declined on a clash", () => {
    const c = h4hChecks({ ...base, date: "2026-10-21", cover: cover() });
    expect(of(c, "cover_clash").state).toBe("fail");
    expect(recommendedH4H(c)).toBe("declined");
  });

  it("recommends Declined on a potential clash", () => {
    const c = h4hChecks({ ...base, date: "2026-10-24", dayNight: "Night", cover: cover({ watch: null, commitments: [{ date: "2026-10-25", dayNight: "Day", what: "an Orange Day", firm: true }] }) });
    expect(recommendedH4H(c)).toBe("declined");
  });

  it("an unapproved request warns without recommending a decline", () => {
    const c = h4hChecks({ ...base, date: "2026-10-21", cover: cover({ watch: null, commitments: [{ date: "2026-10-21", dayNight: "Day", what: "another request", firm: false }] }) });
    expect(of(c, "cover_clash").state).toBe("warn");
    expect(recommendedH4H(c)).toBe("authorised");
  });

  it("leaves it to the WC when the cover isn't in the app", () => {
    const c = h4hChecks({ ...base, date: "2026-10-21", cover: null });
    expect(of(c, "cover_clash").state).toBe("manual");
    expect(recommendedH4H(c)).toBeNull();
  });

  it("says the payback can wait", () => {
    expect(of(h4hChecks({ ...base, date: "2026-10-21", cover: null }), "payback").state).toBe("info");
  });

  it("checks the applicant is free for the payback, and the cover is on shift to pay back", () => {
    const payback = { date: "2026-10-29", dayNight: "Day" as const, applicantCommitments: [], applicantOffDates: new Set<string>() };
    // Applicant on Blue, whose own 1st Day is 29 Oct: a clash.
    const clash = h4hChecks({ ...base, date: "2026-10-21", cover: cover({ watch: null }), payback });
    expect(of(clash, "payback_clash").state).toBe("fail");
    expect(recommendedH4H(clash)).toBe("declined");
    // Cover on Blue, not on a night that day: nothing to pay back.
    const wrong = h4hChecks({ ...base, watch: "White", date: "2026-10-21", cover: cover(), payback: { ...payback, dayNight: "Night" } });
    expect(of(wrong, "payback_clash").detail).toContain("isn't on a night shift");
  });
});

describe("who signs", () => {
  const ff = { user_id: "ff", user_role: "FF", watch: "Blue", cover_user_id: null, cover_watch: null, reviewer_user_id: null };
  const wc = (id: string, watch = "Blue") => ({ id, role: "WC", watch });
  const cc = (id: string, watch = "Blue") => ({ id, role: "CC", watch });

  it("the watch's WC or CC signs a firefighter's request", () => {
    expect(canDecide(wc("w"), ff)).toBe(true);
    expect(canDecide(cc("c"), ff)).toBe(true);
  });

  it("another watch's WC can't", () => {
    expect(canDecide(wc("w", "Red"), ff)).toBe(false);
  });

  it("a firefighter can't", () => {
    expect(canDecide({ id: "x", role: "FF", watch: "Blue" }, ff)).toBe(false);
  });

  it("nobody signs their own", () => {
    expect(canDecide(cc("c"), { ...ff, user_id: "c", user_role: "CC" })).toBe(false);
  });

  it("nobody signs a swap they're covering", () => {
    expect(canDecide(wc("w"), { ...ff, cover_user_id: "w" })).toBe(false);
  });

  it("a CC's request goes to the watch's WC or another CC", () => {
    const r = { ...ff, user_id: "c1", user_role: "CC" };
    expect(canDecide(wc("w"), r)).toBe(true);
    expect(canDecide(cc("c2"), r)).toBe(true);
  });

  it("a WC's own request goes to the WC they chose, not a CC", () => {
    const r = { ...ff, user_id: "w1", user_role: "WC", reviewer_user_id: "w2" };
    expect(canDecide(wc("w2", "Red"), r)).toBe(true);
    expect(canDecide(wc("w3", "Red"), r)).toBe(false);
    expect(canDecide(cc("c"), r)).toBe(false);
    expect(canDecide(wc("w1"), r)).toBe(false);
  });

  it("another WC on the same watch can sign a WC's request too", () => {
    expect(canDecide(wc("w3"), { ...ff, user_id: "w1", user_role: "WC", reviewer_user_id: "w2" })).toBe(true);
  });

  it("the two people and either watch's managers can open the record", () => {
    const r = { ...ff, cover_user_id: "x", cover_watch: "Red" };
    expect(canViewRequest({ id: "ff", role: "FF", watch: "Blue" }, r)).toBe(true);
    expect(canViewRequest({ id: "x", role: "FF", watch: "Red" }, r)).toBe(true);
    expect(canViewRequest(wc("a", "Red"), r)).toBe(true);
    expect(canViewRequest(wc("b", "Green"), r)).toBe(false);
    expect(canViewRequest({ id: "z", role: "FF", watch: "Blue" }, r)).toBe(false);
  });

  it("the applicant or a signer records the Kronos result", () => {
    expect(canRecordOutcome({ id: "ff", role: "FF", watch: "Blue" }, ff)).toBe(true);
    expect(canRecordOutcome(cc("c"), ff)).toBe(true);
    expect(canRecordOutcome({ id: "z", role: "FF", watch: "Blue" }, ff)).toBe(false);
  });
});
