// A person's own days on top of their watch's rota (John, 25 Nov 2026).
// The yearly schedule (a Kronos "Schedule Calendar") is the watch's rota plus
// a few personal days; these are the ones the hub keeps:
//   orange   — OPD/OPN: a rest day they might be called in on. Faint until
//              it's confirmed, by the person or their WC/CC.
//   purple   — IPD/IPN: on shift, but may be sent elsewhere or not needed.
//   training — TC: Training Centre / a course.
//   leave    — RALC/ROFF: leave moved from another date.
//   payback  — FD: a flexi payback day shift.
//   work     — D/N on a day the watch isn't on (leave moved for a course, say).
// A trailing S is the weekend version of the same shift. Sickness (SLT) is
// never kept here: it goes through the sickness log, which has its own
// privacy rules.

export type RosterKind = "orange" | "purple" | "training" | "leave" | "work" | "payback";
export type DayNight = "Day" | "Night";
export interface RosterCode { kind: RosterKind; day_night: DayNight | null }

const CODES: Record<string, RosterCode> = {
  OPD: { kind: "orange", day_night: "Day" }, OPDS: { kind: "orange", day_night: "Day" },
  OPN: { kind: "orange", day_night: "Night" }, OPNS: { kind: "orange", day_night: "Night" },
  IPD: { kind: "purple", day_night: "Day" }, IPDS: { kind: "purple", day_night: "Day" },
  IPN: { kind: "purple", day_night: "Night" }, IPNS: { kind: "purple", day_night: "Night" },
  TC: { kind: "training", day_night: null },
  RALC: { kind: "leave", day_night: null }, ROFF: { kind: "leave", day_night: null },
  FD: { kind: "payback", day_night: "Day" },
  D: { kind: "work", day_night: "Day" }, DS: { kind: "work", day_night: "Day" },
  N: { kind: "work", day_night: "Night" }, NS: { kind: "work", day_night: "Night" },
};

/** What a schedule code means here, or null for one the hub doesn't keep. */
export function rosterCode(code: string): RosterCode | null {
  return CODES[code.trim().toUpperCase()] ?? null;
}

/** Kinds a person (or their WC/CC) can put on a day by hand. */
export const MANUAL_KINDS: RosterKind[] = ["orange", "purple", "training"];
/** Kinds that are a day or a night shift, so must say which. */
export const needsDayNight = (kind: RosterKind) => kind === "orange" || kind === "purple" || kind === "work" || kind === "payback";

export const isIsoDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export interface ImportRow { service_number: string; day: string; code: string }
export interface ImportDay { user_id: string; day: string; kind: RosterKind; day_night: DayNight | null; code: string }
export interface SortedImport {
  days: ImportDay[];
  /** Payroll numbers in the file that nobody in the hub has. */
  unmatched: string[];
  /** Codes the hub doesn't keep, with how many days each. */
  skipped: Record<string, number>;
  /** Lines with no payroll number or a date that isn't a date. */
  bad: number;
}

/**
 * Sort a schedule file's lines into days to keep. One day per person: a later
 * line for the same person and day replaces an earlier one.
 */
export function sortImport(rows: ImportRow[], userByNumber: Map<string, string>): SortedImport {
  const days = new Map<string, ImportDay>();
  const unmatched = new Set<string>();
  const skipped: Record<string, number> = {};
  let bad = 0;
  for (const r of rows) {
    const num = String(r.service_number ?? "").trim();
    const day = String(r.day ?? "").trim();
    const code = String(r.code ?? "").trim().toUpperCase();
    if (!num || !isIsoDay(day) || !code) { bad++; continue; }
    const what = rosterCode(code);
    if (!what) { skipped[code] = (skipped[code] ?? 0) + 1; continue; }
    const user = userByNumber.get(num);
    if (!user) { unmatched.add(num); continue; }
    days.set(`${user}|${day}`, { user_id: user, day, kind: what.kind, day_night: what.day_night, code });
  }
  return { days: [...days.values()], unmatched: [...unmatched].sort(), skipped, bad };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Tue 5 Jan 2027" */
export function niceDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "an orange day (might be called in) · Night" — for a notification. */
export function rosterDayText(kind: RosterKind, dayNight: DayNight | null): string {
  const what: Record<RosterKind, string> = {
    orange: "an orange day (might be called in)",
    purple: "a purple shift (may be sent elsewhere)",
    training: "a training course day",
    leave: "a moved leave day",
    work: "a shift off the rota",
    payback: "a flexi payback shift",
  };
  return dayNight ? `${what[kind]} · ${dayNight}` : what[kind];
}
