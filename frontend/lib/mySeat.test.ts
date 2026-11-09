import { describe, it, expect } from "vitest";
import type { crewing } from "@/client";
import { mySeatLine } from "./mySeat";

const shift = (o: Partial<crewing.MyShift>): crewing.MyShift => ({
  date: "2026-11-14", shift_type: "1st Day", watch: "Blue",
  start: "2026-11-14T08:00:00.000Z", end: "2026-11-14T18:00:00.000Z",
  state: "on", ...o,
});

describe("your seat on the crewing board", () => {
  it("riding: pump and seat", () => {
    expect(mySeatLine({ seat: { kind: "pump", appliance: "b10p1", label: "BA1" }, boardSet: true, ownWatch: true }))
      .toEqual({ tone: "riding", title: "You're on B10P1 · BA1", detail: undefined });
  });

  it("riding on an extra shift says so", () => {
    const l = mySeatLine({
      seat: { kind: "pump", appliance: "b10p2", label: "Driver" }, boardSet: true, ownWatch: false,
      mine: shift({ state: "extra", watch: "Red", why: "H4H cover", with_name: "Andy J" }),
    });
    expect(l).toMatchObject({ title: "You're on B10P2 · Driver", detail: "Extra shift · H4H cover · covering Andy J" });
  });

  it("detached: where, when it's known", () => {
    expect(mySeatLine({ seat: { kind: "detached" }, boardSet: true, ownWatch: true, mine: shift({ state: "detached", detached_to: "Kirkcaldy" }) }))
      .toMatchObject({ tone: "detached", title: "You're detached to Kirkcaldy" });
    expect(mySeatLine({ seat: { kind: "detached" }, boardSet: true, ownWatch: true }))
      .toMatchObject({ title: "You're detached to another station" });
  });

  it("off: why, and who covers", () => {
    expect(mySeatLine({ seat: null, boardSet: true, ownWatch: true, mine: shift({ state: "off", why: "H4H", with_name: "Jo Bloggs" }) }))
      .toEqual({ tone: "off", title: "You're off this shift", detail: "H4H · Jo Bloggs covering" });
    expect(mySeatLine({ seat: null, boardSet: false, ownWatch: true, mine: shift({ state: "off", why: "Flexi" }) }))
      .toMatchObject({ detail: "Flexi day" });
  });

  it("board not set yet, or set without you", () => {
    expect(mySeatLine({ seat: null, boardSet: false, ownWatch: true, mine: shift({}) })).toMatchObject({ tone: "unset", title: "Crewing isn't set yet" });
    expect(mySeatLine({ seat: null, boardSet: true, ownWatch: true })).toMatchObject({ tone: "not", title: "You're not riding this shift" });
  });

  it("an extra you're not placed on yet", () => {
    const mine = shift({ state: "extra", watch: "Red", why: "Orange day" });
    expect(mySeatLine({ seat: null, boardSet: true, ownWatch: false, mine })).toMatchObject({ tone: "not", detail: "You're in for an extra (Orange day) but not on the board yet." });
    expect(mySeatLine({ seat: null, boardSet: false, ownWatch: false, mine })).toMatchObject({ tone: "unset", detail: "You're in for an extra · Orange day" });
  });

  it("someone else's watch with nothing of yours: no line", () => {
    expect(mySeatLine({ seat: null, boardSet: true, ownWatch: false })).toBeNull();
  });
});
