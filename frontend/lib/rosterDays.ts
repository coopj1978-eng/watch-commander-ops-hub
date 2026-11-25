// A person's own days on top of their watch's rota (John, 25 Nov 2026): the
// yearly schedule gives everyone orange days (a rest day they might be called
// in on — faint until confirmed, then darker) and purple shifts (on shift,
// but may be sent elsewhere or not needed), plus the odd course or moved
// leave day. Server: backend/shift-adjustments/roster_days.ts.

import type { DayNight, MyDay } from "./myShifts";

export type RosterKind = "orange" | "purple" | "training" | "leave" | "work" | "payback";

export interface RosterDayLike {
  id: number;
  user_id: string;
  /** YYYY-MM-DD */
  day: string;
  kind: RosterKind;
  day_night: DayNight | null;
  confirmed: boolean;
}

export const KIND_LABEL: Record<RosterKind, string> = {
  orange: "Orange day",
  purple: "Purple shift",
  training: "Training course",
  leave: "Leave (moved)",
  work: "Rostered shift",
  payback: "Flexi payback",
};

/** One line on what the day means, for the card that opens. */
export function kindMeaning(kind: RosterKind, confirmed: boolean): string {
  switch (kind) {
    case "orange":
      return confirmed
        ? "You're confirmed in for this shift."
        : "A rest day you might be called in on. It stays faint until it's confirmed.";
    case "purple": return "You're on shift, but may be sent to another station or not needed — and called in on another day instead.";
    case "training": return "Training Centre or a course.";
    case "leave": return "Leave moved here from another date.";
    case "work": return "A shift you're rostered for when your watch isn't on.";
    case "payback": return "A flexi payback shift.";
  }
}

/** "Day 08–18" / "Night 18–08" */
export const shiftHours = (dn: DayNight | null | undefined) => (dn === "Day" ? "Day 08–18" : dn === "Night" ? "Night 18–08" : "");

/**
 * Your calendar days with your roster days added. A booking already on the
 * day wins (it's what you've actually arranged) — except a confirmed orange
 * day, which IS its Orange Day booking, so the two are shown as one.
 */
export function withRosterDays(base: Map<string, MyDay>, days: RosterDayLike[], me: string): Map<string, MyDay> {
  const out = new Map(base);
  for (const d of days) {
    if (d.user_id !== me) continue;
    const there = out.get(d.day);
    const shift = d.day_night ?? undefined;
    if (d.kind === "orange" && d.confirmed) {
      out.set(d.day, there?.state === "in"
        ? { ...there, tone: "orange", rosterId: d.id }
        : { state: "in", label: KIND_LABEL.orange, shift, tone: "orange", rosterId: d.id });
      continue;
    }
    if (there) continue;
    switch (d.kind) {
      case "orange": out.set(d.day, { state: "maybe", label: KIND_LABEL.orange, shift, tone: "maybe", rosterId: d.id }); break;
      case "purple": out.set(d.day, { state: "note", label: KIND_LABEL.purple, shift, tone: "purple", rosterId: d.id }); break;
      case "training": out.set(d.day, { state: "note", label: KIND_LABEL.training, rosterId: d.id }); break;
      case "leave": out.set(d.day, { state: "off", label: KIND_LABEL.leave, rosterId: d.id }); break;
      case "work":
      case "payback": out.set(d.day, { state: "in", label: KIND_LABEL[d.kind], shift, rosterId: d.id }); break;
    }
  }
  return out;
}

// ── A schedule file (admin) ──────────────────────────────────────────────────

export interface ScheduleRow { service_number: string; day: string; code: string }

/** "2027-01-05" from "2027-01-05" or "05/01/2027"; "" when it isn't a date. */
function isoFrom(v: string): string {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return uk ? `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}` : "";
}

/**
 * Read a schedule file: one line per person per day — payroll number, date,
 * code — separated by commas, semicolons or tabs. A heading line is skipped.
 */
export function parseScheduleCsv(text: string): { rows: ScheduleRow[]; bad: number } {
  const rows: ScheduleRow[] = [];
  let bad = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [num = "", date = "", code = ""] = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (!/^\d+$/.test(num)) { if (rows.length || bad) bad++; continue; } // the heading, or a broken line
    const day = isoFrom(date);
    if (!day || !code) { bad++; continue; }
    rows.push({ service_number: num, day, code: code.toUpperCase() });
  }
  return { rows, bad };
}
