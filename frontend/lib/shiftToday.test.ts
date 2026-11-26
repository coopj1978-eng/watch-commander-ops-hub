import { describe, expect, it } from "vitest";
import { CANTEEN_LINK, shiftToday, shortName, todayLeft, type TodayShift } from "./shiftToday";

// Monday 30 Nov 2026, a day shift 08:00–18:00.
const on: TodayShift = { date: "2026-11-30", type: "day", start: "2026-11-30T08:00:00Z", end: "2026-11-30T18:00:00Z", on_duty: true };
const base = { shift: on, tasks: [], templates: [], events: [], canteen: [] };

describe("what's on this shift, one line each", () => {
  it("lists the routine cards on the board with how far through they are", () => {
    const r = shiftToday({
      ...base,
      tasks: [
        { id: 1, title: "Monday weekly", kind: "check", status: "InProgress", checklist: [{ label: "a", done: true }, { label: "b", done: false }, { label: "c", done: false }] },
        { id: 2, title: "Start of shift – Crew", kind: "check", status: "Done", checklist: [{ label: "a", done: true }] },
      ],
    });
    expect(r[0]).toMatchObject({ kind: "check", label: "Monday weekly", note: "1/3", to: "/tasks", done: false });
    expect(r[1]).toMatchObject({ label: "Start of shift – Crew", done: true });
    expect(r[1].note).toBeUndefined();
  });

  it("shows a timed HFSV by its time and just 'HFSV'", () => {
    const r = shiftToday({
      ...base,
      events: [{ id: "insp-9", type: "hfsv", when: "2026-11-30T13:00:00Z", what: "HFSV 1/2 12 Some Street, Mrs Someone", link: "/calendar?date=2026-11-30" }],
    });
    expect(r[0]).toMatchObject({ kind: "event", time: "13:00", label: "HFSV", to: "/calendar?date=2026-11-30" });
  });

  it("puts calendar events in time order and leaves out ones outside the shift", () => {
    const r = shiftToday({
      ...base,
      events: [
        { id: "cal-5", type: "meeting", when: "2026-11-30T15:30:00Z", what: "Station meeting" },
        { id: "cal-4", type: "drill", when: "2026-11-30T10:00:00Z", what: "Pump drill" },
        { id: "cal-6", type: "other", when: "2026-11-30T19:00:00Z", what: "Tonight's thing" },
      ],
    });
    expect(r.filter((x) => x.kind === "event").map((x) => `${x.time} ${x.label}`)).toEqual(["10:00 Pump drill", "15:30 Station meeting"]);
    expect(r.find((x) => x.label === "Station meeting")!.to).toBe("/calendar");
  });

  it("shows an all-day entry first with no time, on the day the shift starts", () => {
    const r = shiftToday({
      ...base,
      events: [
        { id: "cal-4", type: "drill", when: "2026-11-30T10:00:00Z", what: "Pump drill" },
        { id: "cal-8", type: "other", when: "2026-11-30T00:00:00Z", what: "Station open day" },
      ],
    });
    const events = r.filter((x) => x.kind === "event");
    expect(events.map((x) => x.label)).toEqual(["Station open day", "Pump drill"]);
    expect(events[0].time).toBeUndefined();
  });

  it("leaves tomorrow's all-day entry off a night shift that runs past midnight", () => {
    const night: TodayShift = { date: "2026-11-30", type: "night", start: "2026-11-30T18:00:00Z", end: "2026-12-01T08:00:00Z", on_duty: true };
    const r = shiftToday({
      ...base, shift: night,
      events: [
        { id: "cal-9", type: "other", when: "2026-12-01T00:00:00Z", what: "Tomorrow's all-day thing" },
        { id: "cal-10", type: "other", when: "2026-12-01T02:30:00Z", what: "Standby move" },
      ],
    });
    expect(r.filter((x) => x.kind === "event").map((x) => `${x.time} ${x.label}`)).toEqual(["02:30 Standby move"]);
  });

  it("opens the board for an event that has a card there, and doesn't count that card again", () => {
    const r = shiftToday({
      ...base,
      tasks: [
        { id: 7, title: "Pump drill", kind: "calendar", status: "Done", calendar_event_id: 4 },
        { id: 8, title: "Fix the hose reel", kind: "watch", status: "NotStarted" },
        { id: 9, title: "Old job", kind: "watch", status: "Done" },
      ],
      events: [{ id: "cal-4", type: "drill", when: "2026-11-30T10:00:00Z", what: "Pump drill" }],
    });
    expect(r.find((x) => x.kind === "event")).toMatchObject({ to: "/tasks", done: true });
    expect(r.find((x) => x.kind === "jobs")).toMatchObject({ label: "1 job on the board", to: "/tasks" });
  });

  it("says who's on canteen, or that nobody's been put down yet", () => {
    expect(shiftToday({ ...base, canteen: ["Andy James", "Chris Wilson"] }).at(-1))
      .toMatchObject({ kind: "canteen", label: "Canteen · Andy J & Chris W", to: CANTEEN_LINK });
    expect(shiftToday(base).at(-1)).toMatchObject({ kind: "canteen", label: "Canteen", note: "not set yet", empty: true });
  });

  it("says when there's a handover still to read, just above canteen", () => {
    const r = shiftToday({ ...base, handoverToRead: 2 });
    expect(r.at(-2)).toMatchObject({ kind: "handover", label: "Handover to read", note: "2", to: "/tasks" });
    expect(shiftToday({ ...base, handoverToRead: 0 }).some((x) => x.kind === "handover")).toBe(false);
  });

  it("before the shift starts, says which routine cards are coming", () => {
    const next: TodayShift = { ...on, on_duty: false };
    const r = shiftToday({
      ...base, shift: next,
      templates: [
        { id: 1, name: "Monday weekly", is_active: true, routine_slot: "MO-day", routine_rule: "weekly", checklist: [{ label: "a", done: false }, { label: "b", done: false }] },
        { id: 2, name: "Tuesday weekly", is_active: true, routine_slot: "TU-day", routine_rule: "weekly", checklist: [] },
        { id: 3, name: "Start of shift – Crew", is_active: true, routine_slot: "every", checklist: [{ label: "a", done: false }] },
        { id: 4, name: "Paused card", is_active: false, routine_slot: "MO-day", routine_rule: "weekly", checklist: [] },
      ],
    });
    expect(r.filter((x) => x.kind === "check").map((x) => `${x.label} (${x.note})`)).toEqual(["Start of shift – Crew (1 check)", "Monday weekly (2 checks)"]);
    // once the shift is on, only what's actually on the board counts
    expect(shiftToday({ ...base, templates: [{ id: 1, name: "Monday weekly", routine_slot: "MO-day", routine_rule: "weekly" }] }).some((x) => x.kind === "check")).toBe(false);
  });

  it("counts what's still to do, leaving canteen out", () => {
    const r = shiftToday({
      ...base,
      tasks: [
        { id: 1, title: "Monday weekly", kind: "check", status: "InProgress" },
        { id: 2, title: "Start of shift", kind: "check", status: "Done" },
      ],
      canteen: ["Andy James"],
    });
    expect(todayLeft(r)).toBe(1);
  });
});

describe("a name short enough for one line", () => {
  it("keeps the first name and the surname's initial", () => {
    expect(shortName("Andy James")).toBe("Andy J");
    expect(shortName("  Mary Anne   McDonald ")).toBe("Mary M");
    expect(shortName("Cher")).toBe("Cher");
  });
});
