// Your own next shifts (Nov 2026), for the top of a firefighter's Home: the
// watch's rota, changed by your own bookings. The council's "My next shifts"
// strip: each shift tagged on / riding where / off (and why) / detached /
// an extra shift you're covering / a request still waiting.
//
// Off reasons come from the riding count (lib/strength.ts) run for just you,
// so Home, the calendar and the crewing board all agree on who's away.

import { shiftStrength, type AwayWhy, type CoverWhy, type StrengthAbsence, type StrengthAdjustment } from "./strength";
import { addDaysIso, shiftSlot, watchShiftOn } from "./shiftRota";

export type DayNight = "Day" | "Night";

/** Your seat on a crewing board. */
export interface MyCrewing { date: string; shift_type: string; watch: string; appliance: string; crew_role: string }
/** A detachment logged for you. */
export interface MyDetachment { date: string; to_station: string }
/** Your own Flexi/H4H request that's still going through. */
export interface MyOpenRequest { type: string; date: string; day_night: DayNight }

export interface MyShift {
  /** YYYY-MM-DD the shift starts (a night runs to 08:00 the next day). */
  date: string;
  /** "1st Day"…"2nd Night" on the watch you're working, or "Day"/"Night" when that watch's rota doesn't say. */
  shift_type: string;
  /** Whose shift it is: your own watch, or the one you're covering. */
  watch: string;
  /** ISO instants. */
  start: string;
  end: string;
  /**
   * on — you're working your own watch's shift;
   * off — you're not (why says Sick, Leave, Flexi, Training, H4H or TOIL);
   * detached — you're working it at another station;
   * extra — an extra shift on another watch (why says H4H cover, TOIL cover, Flexi payback or Orange day).
   */
  state: "on" | "off" | "detached" | "extra";
  why?: Exclude<AwayWhy, "Detached"> | CoverWhy;
  /** H4H/TOIL: who covers you (off), or whom you cover (extra). */
  with_name?: string;
  /** Where you ride, once the crewing board is set. */
  seat?: { appliance: string; role: string };
  detached_to?: string;
  /** Your Flexi/H4H request for this shift is still waiting. */
  waiting?: "Flexi" | "H4H";
}

/** The watch's annual-leave block. */
export interface MyLeave { start: string; end: string; back: string | null }

const LEAVE = "Annual Leave";
const isShift = (s: string | null): s is "1st Day" | "2nd Day" | "1st Night" | "2nd Night" => !!s && /Day|Night/.test(s);
const dayNightOf = (label: string): DayNight => (label.includes("Night") ? "Night" : "Day");
const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const covers = (a: StrengthAdjustment, date: string, dn: DayNight) => a.start <= date && a.end >= date && (!a.day_night || a.day_night === dn);
const WAITING_LABEL: Record<string, "Flexi" | "H4H"> = { flexi: "Flexi", h4h: "H4H" };
const EXTRA_WHY: Record<string, CoverWhy> = { flexi_payback: "Flexi payback", orange_day: "Orange day" };

/**
 * Your shifts from `from` to `to` (inclusive dates) that haven't finished by
 * `now`, soonest first, and the watch's next leave block if it starts by `to`.
 */
export function myShifts(i: {
  me: { id: string; name: string };
  watch: string | null;
  from: string;
  to: string;
  now: Date;
  absences: StrengthAbsence[];
  adjustments: StrengthAdjustment[];
  crewing: MyCrewing[];
  detachments: MyDetachment[];
  requests: MyOpenRequest[];
}): { shifts: MyShift[]; leave: MyLeave | null } {
  const { me, watch, now } = i;
  const shifts: MyShift[] = [];
  const seatOn = (date: string, label: string, w: string) =>
    i.crewing.find((c) => c.date === date && c.shift_type === label && same(c.watch, w));
  const slotFor = (date: string, dn: DayNight) => shiftSlot(date, dn === "Night" ? "night" : "day");

  for (let date = i.from; date <= i.to; date = addDaysIso(date, 1)) {
    // Your own watch's shift.
    const label = watch ? watchShiftOn(watch, date) : null;
    if (watch && isShift(label)) {
      const dn = dayNightOf(label);
      const slot = slotFor(date, dn);
      if (slot.end > now) {
        const seat = seatOn(date, label, watch);
        const r = shiftStrength({
          watch, date, dayNight: dn,
          roster: [me],
          absences: i.absences,
          adjustments: i.adjustments.filter((a) => a.user_id === me.id),
          detachedIds: seat?.appliance === "detached" ? new Set([me.id]) : undefined,
        });
        const why = r.away[0]?.why;
        const base = { date, shift_type: label, watch, start: slot.start.toISOString(), end: slot.end.toISOString() };
        if (why === "Detached") {
          const to = i.detachments.find((d) => d.date === date)?.to_station;
          shifts.push({ ...base, state: "detached", ...(to ? { detached_to: to } : {}) });
        } else if (why) {
          const type = why === "H4H" ? "h4h" : why === "TOIL" ? "toil" : null;
          const booking = type ? i.adjustments.find((a) => a.user_id === me.id && a.type === type && covers(a, date, dn)) : undefined;
          shifts.push({ ...base, state: "off", why, ...(booking?.covering_name ? { with_name: booking.covering_name } : {}) });
        } else {
          const asked = i.requests.find((q) => q.date === date && q.day_night === dn && WAITING_LABEL[q.type]);
          shifts.push({
            ...base,
            state: "on",
            ...(seat && seat.appliance !== "detached" ? { seat: { appliance: seat.appliance, role: seat.crew_role } } : {}),
            ...(asked ? { waiting: WAITING_LABEL[asked.type] } : {}),
          });
        }
      }
    }

    // Extra shifts on another watch: covering someone's H4H/TOIL, or your
    // own Flexi payback / Orange day.
    for (const a of i.adjustments) {
      if (a.start > date || a.end < date) continue;
      let onWatch: string | null = null;
      let why: CoverWhy | null = null;
      let withName: string | undefined;
      if ((a.type === "h4h" || a.type === "toil") && a.covering_user_id === me.id && a.user_id !== me.id) {
        onWatch = a.watch_unit;
        why = a.type === "h4h" ? "H4H cover" : "TOIL cover";
        withName = a.user_name || undefined;
      } else if (EXTRA_WHY[a.type] && a.user_id === me.id) {
        onWatch = a.covering_watch;
        why = EXTRA_WHY[a.type];
      }
      if (!why) continue;
      // The covered watch's rota names the shift; a booking's own Day/Night wins.
      const theirs = onWatch ? watchShiftOn(onWatch, date) : null;
      const dn: DayNight | null = a.day_night ?? (isShift(theirs) ? dayNightOf(theirs) : null);
      if (!dn) continue; // nothing says which shift: the other watch isn't on and the booking doesn't say
      const shiftType = isShift(theirs) && dayNightOf(theirs) === dn ? theirs : dn;
      const slot = slotFor(date, dn);
      if (slot.end <= now) continue;
      if (shifts.some((s) => s.state === "extra" && s.date === date && dayNightOf(s.shift_type) === dn)) continue;
      const seat = onWatch ? seatOn(date, shiftType, onWatch) : undefined;
      shifts.push({
        date, shift_type: shiftType, watch: onWatch ?? "", start: slot.start.toISOString(), end: slot.end.toISOString(),
        state: "extra", why,
        ...(withName ? { with_name: withName } : {}),
        ...(seat && seat.appliance !== "detached" ? { seat: { appliance: seat.appliance, role: seat.crew_role } } : {}),
      });
    }
  }

  shifts.sort((a, b) => a.start.localeCompare(b.start));
  return { shifts, leave: watch ? leaveBlock(watch, i.from, i.to) : null };
}

/** The watch's leave block that's on at `from` or starts by `to`, with the first shift back. */
export function leaveBlock(watch: string, from: string, to: string): MyLeave | null {
  let start: string | null = null;
  for (let d = from; d <= to; d = addDaysIso(d, 1)) {
    if (watchShiftOn(watch, d) === LEAVE) { start = d; break; }
  }
  if (!start) return null;
  // Already on leave at `from`: find the real first day (blocks are 18 days).
  for (let n = 0; n < 30 && watchShiftOn(watch, addDaysIso(start, -1)) === LEAVE; n++) start = addDaysIso(start, -1);
  let end = start;
  for (let n = 0; n < 30 && watchShiftOn(watch, addDaysIso(end, 1)) === LEAVE; n++) end = addDaysIso(end, 1);
  let back: string | null = null;
  for (let d = addDaysIso(end, 1), n = 0; n < 14; d = addDaysIso(d, 1), n++) {
    if (isShift(watchShiftOn(watch, d))) { back = d; break; }
  }
  return { start, end, back };
}
