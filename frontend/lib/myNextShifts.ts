// Wording for "My next shifts" on Home (Nov 2026). The shifts come from
// GET /crewing/my-shifts (backend lib/myShifts.ts); this turns one into the
// few words a firefighter reads on a phone: when, which shift, and whether
// they're on, off, detached or in for an extra.

import type { crewing } from "@/client";

type MyShift = crewing.MyShift;
type MyLeave = crewing.MyLeave;

const ROLE: Record<string, string> = { oic: "OIC", driver: "Driver", ba: "BA", baeco: "BA ECO", ff: "FF" };
const OFF: Record<string, string> = { Flexi: "Flexi day", Training: "Training", H4H: "H4H", TOIL: "TOIL", Leave: "Leave" };
const EXTRA: Record<string, string> = { "H4H cover": "H4H", "TOIL cover": "TOIL cover", "Flexi payback": "Flexi payback", "Orange day": "Orange day" };

export interface ShiftLine {
  /** "Now", "Today", "Tonight", "Tomorrow", "Tomorrow night" or "Sat 14". */
  when: string;
  /** The date under a relative `when` ("Mon 9"), otherwise empty. */
  date: string;
  /** "1st Night", or "Red · 1st Day" for an extra shift. */
  shift: string;
  /** "18:00–08:00". */
  times: string;
  /** The pill: "B10P1 · BA", "On", "Off · Flexi day", "Off sick", "Detached", "Extra · Orange day". */
  tag: string;
  /** One short line under the shift: who covers, where, what's waiting, time left. */
  detail?: string;
  /** Detail that needs a look (a request still waiting). */
  waiting: boolean;
  tone: MyShift["state"];
  night: boolean;
  now: boolean;
}

/** Local YYYY-MM-DD. */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n));
};
/** "Sat 14". */
const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
/** "Thu 26 Nov". */
const shortMonth = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
/** "26 Nov". */
const dayMonth = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function timeLeft(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${String(mins % 60).padStart(2, "0")}m` : `${mins}m`;
}

/** The pill text alone (also the shift panel's "You: …" when you're not riding). */
export function shiftTag(s: MyShift): string {
  switch (s.state) {
    case "on":
      return s.seat ? `${s.seat.appliance.toUpperCase()} · ${ROLE[s.seat.role] ?? s.seat.role}` : "On";
    case "off":
      return s.why === "Sick" ? "Off sick" : `Off · ${OFF[s.why ?? ""] ?? s.why ?? "booked"}`;
    case "detached":
      return s.detached_to ? `Detached · ${s.detached_to}` : "Detached";
    case "extra":
      return `Extra · ${EXTRA[s.why ?? ""] ?? s.why ?? "shift"}`;
  }
}

export function shiftLine(s: MyShift, now: Date): ShiftLine {
  const start = new Date(s.start);
  const end = new Date(s.end);
  const night = s.shift_type.includes("Night");
  const running = start <= now && now < end;
  const today = localDay(now);

  let when: string;
  let date = short(s.date);
  if (running) when = "Now";
  else if (s.date === today) when = night ? "Tonight" : "Today";
  else if (s.date === addDays(today, 1)) when = night ? "Tomorrow night" : "Tomorrow";
  else { when = date; date = ""; }

  let detail: string | undefined;
  let waiting = false;
  if (s.state === "off" && s.with_name) detail = `${s.with_name} covering`;
  else if (s.state === "extra" && s.with_name) detail = `Covering ${s.with_name}`;
  else if (s.state === "detached") detail = s.detached_to ? `At ${s.detached_to}` : "At another station";
  else if (s.state === "on" && s.waiting) { detail = `${s.waiting === "Flexi" ? "Flexi day" : "H4H"} asked for · waiting`; waiting = true; }
  if (running && s.state !== "off") detail = detail ? `${detail} · ${timeLeft(end.getTime() - now.getTime())} left` : `${timeLeft(end.getTime() - now.getTime())} left`;

  return {
    when,
    date,
    shift: s.state === "extra" && s.watch ? `${s.watch} · ${s.shift_type}` : s.shift_type,
    times: `${hhmm(start)}–${hhmm(end)}`,
    tag: s.state === "detached" ? "Detached" : shiftTag(s),
    detail,
    waiting,
    tone: s.state,
    night,
    now: running,
  };
}

/** The watch's leave block as one row: on it now, or coming up. */
export function leaveLine(l: MyLeave, today: string): { title: string; detail: string } {
  if (l.start <= today) {
    return { title: "On annual leave", detail: l.back ? `Back ${shortMonth(l.back)}` : `Until ${shortMonth(l.end)}` };
  }
  return {
    title: "Annual leave",
    detail: `${dayMonth(l.start)} – ${dayMonth(l.end)}${l.back ? ` · back ${shortMonth(l.back)}` : ""}`,
  };
}
