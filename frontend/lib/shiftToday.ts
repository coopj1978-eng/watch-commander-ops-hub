// The short "what's on this shift" list in the Home hero (John, 26 Nov 2026:
// "the to dos for that day, not a lot of details — just things like the
// header 'Monday weekly', '1.00 HFSV', any events in the calendar for that
// day, the canteen duty … all linking to each section in the app").
//
// One line each, in the order the shift runs: the routine and check cards,
// timed things (an HFSV, a calendar event) at their time, the jobs on the
// board as one count, and who's on canteen. The fuller version, with the
// detail, is the running order further down Home.

import { routineRuleFires } from "./routineRules";

export type TodayKind = "check" | "event" | "jobs" | "canteen";

export interface TodayItem {
  key: string;
  kind: TodayKind;
  /** "13:00" — only for something with a time. */
  time?: string;
  label: string;
  /** A few words on the right: "3/8", "2 checks", "not set yet". */
  note?: string;
  done?: boolean;
  /** Nobody's been put down yet (canteen): shown quieter. */
  empty?: boolean;
  /** Where the line goes when pressed. */
  to: string;
}

export interface TodayShift {
  /** YYYY-MM-DD the shift starts. */
  date: string;
  type: "day" | "night";
  start: string;
  end: string;
  /** False when it's the watch's next shift, not one that's running. */
  on_duty: boolean;
}

export interface TodayTask {
  id: number;
  title: string;
  kind: string;
  status: string;
  checklist?: unknown;
  calendar_event_id?: number | null;
}

export interface TodayTemplate {
  id: number;
  name: string;
  is_active?: boolean;
  routine_slot?: string | null;
  routine_rule?: string | null;
  routine_position?: number | null;
  checklist?: unknown;
}

export interface TodayEvent {
  id: string;
  type?: string;
  when: string;
  what: string;
  link?: string;
}

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
/** Kinds of scheduled thing that are better named by what they are than by their full title. */
const SHORT_NAME: Record<string, string> = { hfsv: "HFSV", high_rise: "Multi-storey inspection", hydrant: "Hydrants" };
export const CANTEEN_LINK = "/handover?tab=detachments&rota=canteen";

function listOf(v: unknown): { label: string; done: boolean }[] {
  const arr = typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return []; } })() : v;
  return Array.isArray(arr) ? arr : [];
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** "Andy James" → "Andy J" — enough to know who, short enough for one line. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}`;
}

export function shiftToday(i: {
  shift: TodayShift;
  tasks: TodayTask[];
  templates: TodayTemplate[];
  events: TodayEvent[];
  /** Names of whoever is on canteen this shift. */
  canteen: string[];
}): TodayItem[] {
  const { shift, tasks } = i;
  const start = new Date(shift.start).getTime();
  const end = new Date(shift.end).getTime();
  const items: TodayItem[] = [];

  // ── The routine and check cards on the board.
  const checks = tasks.filter((t) => t.kind === "check");
  for (const t of checks) {
    const list = listOf(t.checklist);
    const done = t.status === "Done";
    items.push({
      key: `check-${t.id}`, kind: "check", label: t.title, to: "/tasks", done,
      note: done ? undefined : list.length ? `${list.filter((l) => l.done).length}/${list.length}` : undefined,
    });
  }
  // Before the shift starts its cards haven't been made yet: say what's coming
  // from the weekly routine.
  if (!shift.on_duty) {
    const onBoard = new Set(checks.map((t) => t.title.trim().toLowerCase()));
    const slot = `${DAYS[new Date(`${shift.date}T12:00:00`).getDay()]}-${shift.type}`;
    const due = i.templates
      .filter((t) => t.is_active !== false && (t.routine_slot === "every" || (t.routine_slot === slot && routineRuleFires(t.routine_rule ?? "weekly", shift.date))))
      .filter((t) => !onBoard.has(t.name.trim().toLowerCase()))
      .sort((a, b) => Number(b.routine_slot === "every") - Number(a.routine_slot === "every") || (a.routine_position ?? 0) - (b.routine_position ?? 0));
    for (const t of due) {
      const n = listOf(t.checklist).length;
      items.push({ key: `routine-${t.id}`, kind: "check", label: t.name, to: "/tasks", note: n ? `${n} check${n === 1 ? "" : "s"}` : undefined });
    }
  }

  // ── Timed things inside the shift, in time order. A calendar event with a
  //    card on the board opens the board, and shows done when its card is.
  const shown = new Set<number>();
  const timed = i.events
    .map((e) => ({ e, at: new Date(e.when).getTime() }))
    .filter(({ at }) => at >= start && at < end)
    .sort((a, b) => a.at - b.at);
  for (const { e } of timed) {
    const calId = e.id.startsWith("cal-") ? Number(e.id.slice(4)) : NaN;
    const card = Number.isFinite(calId) ? tasks.find((t) => t.calendar_event_id === calId) : undefined;
    if (card) shown.add(calId);
    items.push({
      key: `event-${e.id}`, kind: "event", time: hhmm(e.when),
      label: SHORT_NAME[e.type ?? ""] ?? e.what,
      to: card ? "/tasks" : e.link || "/calendar",
      done: card?.status === "Done",
    });
  }

  // ── Everything else on the board, as one line.
  const jobs = tasks.filter((t) => t.kind !== "check" && t.status !== "Done" && t.status !== "Missed" && !(t.calendar_event_id && shown.has(t.calendar_event_id)));
  if (jobs.length) {
    items.push({ key: "jobs", kind: "jobs", label: `${jobs.length} job${jobs.length === 1 ? "" : "s"} on the board`, to: "/tasks" });
  }

  // ── Canteen for the shift.
  const names = i.canteen.map(shortName).filter(Boolean);
  items.push(names.length
    ? { key: "canteen", kind: "canteen", label: `Canteen · ${names.join(" & ")}`, to: CANTEEN_LINK }
    : { key: "canteen", kind: "canteen", label: "Canteen", note: "not set yet", empty: true, to: CANTEEN_LINK });

  return items;
}

/** How many of the lines still need doing (canteen is a duty, not a job). */
export function todayLeft(items: TodayItem[]): number {
  return items.filter((it) => it.kind !== "canteen" && !it.done).length;
}
