import { api, Query } from "encore.dev/api";
import db from "../db";
import { ensureStationChecks } from "../lib/stationChecks";
import { sendBackToWorkReminders } from "../lib/backToWork";
import { shiftSlot, slotAt, slotForWatch, watchForSlot, type SlotType } from "../lib/shiftRota";
import type { Task } from "./types";

// The shift board (Oct 2026): everything the watch on duty should see this
// shift — station checks (from templates), "needs doing" handover lines from
// earlier shifts, the watch's own tasks due by the end of the shift
// (unfinished ones from earlier shifts roll on by themselves) and the
// calendar's tasks for the day. Done shows only this shift's work.

interface ShiftBoardRequest {
  /** A watch's own board (its current or next shift). Default: the watch on duty now. */
  watch?: Query<string>;
}

export interface ShiftInfo {
  watch: string | null;
  /** The date the shift started (a night belongs to the day it began). */
  date: string;
  type: "day" | "night";
  /** Rota label, e.g. "2nd Night". */
  label: string;
  start: Date;
  end: Date;
  /** False when showing a watch's next shift while another watch is on. */
  on_duty: boolean;
}

export interface ShiftTask extends Task {
  kind: "check" | "handover" | "watch" | "calendar";
  /** Handover lines: who handed it over, e.g. "Blue Watch · Night 25 Oct". */
  handover_from?: string;
  /** Station checks: shift | daily | weekly | fortnightly | monthly | quarterly | repeat. */
  check_freq?: string;
  completed_by_name?: string;
}

export interface ShiftBoardResponse {
  shift: ShiftInfo;
  /** Watch on duty right now. */
  on_duty_watch: string | null;
  tasks: ShiftTask[];
}

function checkFreq(perShift: boolean | null, rrule: string | null): string {
  if (perShift) return "shift";
  const freq = rrule?.match(/FREQ=([A-Z]+)/)?.[1];
  const interval = parseInt(rrule?.match(/INTERVAL=(\d+)/)?.[1] ?? "1") || 1;
  if (freq === "DAILY") return "daily";
  if (freq === "WEEKLY") return interval === 2 ? "fortnightly" : "weekly";
  if (freq === "MONTHLY") return interval === 3 ? "quarterly" : "monthly";
  return "repeat";
}

export const shiftBoard = api<ShiftBoardRequest, ShiftBoardResponse>(
  { auth: true, expose: true, method: "GET", path: "/api/tasks/shift" },
  async (req) => {
    // Make sure this shift's station checks exist (the hourly job also does).
    await ensureStationChecks().catch(() => undefined);
    // Back to work reminders for anyone whose first shift back has started.
    await sendBackToWorkReminders().catch(() => 0);

    const now = new Date();
    const current = slotAt(now);
    const onDuty = watchForSlot(current);

    let shift: ShiftInfo = {
      watch: onDuty?.watch ?? null, date: current.date, type: current.type,
      label: onDuty?.label ?? (current.type === "day" ? "Day shift" : "Night shift"),
      start: current.start, end: current.end, on_duty: true,
    };
    const asked = req.watch?.trim();
    if (asked && asked.toLowerCase() !== (onDuty?.watch ?? "").toLowerCase()) {
      const s = slotForWatch(asked, now);
      if (s) {
        const watch = asked[0].toUpperCase() + asked.slice(1).toLowerCase();
        shift = { watch, date: s.date, type: s.type, label: s.label, start: s.start, end: s.end, on_duty: s.onDuty };
      }
    }

    const rows = await db.rawQueryAll<any>(
      `SELECT t.*, u.name AS completed_by_name, tt.per_shift, tt.rrule AS template_rrule,
              ho.watch AS ho_watch, ho.shift_type AS ho_type, ho.shift_date AS ho_date
       FROM tasks t
       LEFT JOIN task_template_instances i ON i.task_id = t.id
       LEFT JOIN task_templates tt ON tt.id = i.template_id
       LEFT JOIN users u ON u.id = t.completed_by
       LEFT JOIN handover_items hi ON hi.task_id = t.id
       LEFT JOIN handovers ho ON ho.id = hi.handover_id
       WHERE (
         ($1::boolean AND t.source_type IN ('template', 'handover') AND t.watch_unit IS NULL AND (
            (t.status NOT IN ('Done', 'Missed') AND t.created_at < $3)
            OR (t.status = 'Done' AND t.completed_at >= $2)))
         OR
         ($4::text IS NOT NULL AND LOWER(t.watch_unit) = LOWER($4::text) AND t.source_type IS DISTINCT FROM 'template' AND t.source_type IS DISTINCT FROM 'handover' AND (
            (t.status NOT IN ('Done', 'Missed') AND (t.due_at IS NULL OR t.due_at < $3))
            OR (t.status = 'Done' AND t.completed_at >= $2)))
       )
       ORDER BY t.position ASC, t.created_at ASC`,
      shift.on_duty, shift.start, shift.end, shift.watch
    );

    const tasks: ShiftTask[] = rows.map((t) => {
      const { per_shift, template_rrule, ho_watch, ho_type, ho_date, ...rest } = t;
      const kind: ShiftTask["kind"] =
        t.source_type === "template" ? "check"
        : t.source_type === "handover" ? "handover"
        : t.source_type === "station_event" || t.calendar_event_id ? "calendar" : "watch";
      const hoDate = ho_date ? new Date(ho_date instanceof Date ? ho_date.toISOString().slice(0, 10) + "T12:00:00Z" : String(ho_date).slice(0, 10) + "T12:00:00Z") : null;
      return {
        ...rest,
        checklist: typeof t.checklist === "string" ? JSON.parse(t.checklist) : t.checklist,
        attachments: Array.isArray(t.attachments) ? t.attachments : (t.attachments ?? undefined),
        tags: Array.isArray(t.tags) ? t.tags : (t.tags ?? undefined),
        completed_by_name: t.completed_by_name ?? undefined,
        kind,
        check_freq: kind === "check" ? checkFreq(per_shift, template_rrule ?? t.rrule) : undefined,
        handover_from: kind === "handover" && ho_watch
          ? `${ho_watch} Watch · ${ho_type} ${hoDate ? hoDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : ""}`.trim()
          : undefined,
      };
    });

    return { shift, on_duty_watch: onDuty?.watch ?? null, tasks };
  }
);

// ─── Missed station checks (for the WC dashboard and the Tasks page) ─────────

export interface MissedCheck {
  id: number;
  title: string;
  /** The day (or night, dated the day it started) it was for. */
  date: string;
  /** "day" / "night" for every-shift checks; "" for daily and longer. */
  shift: string;
  /** shift | daily | weekly | fortnightly | monthly | quarterly | repeat */
  freq: string;
  /** Watches on duty when it was due — none for weekly and longer (the station's). */
  watches: string[];
}

export const missedChecks = api<{ days?: Query<number> }, { checks: MissedCheck[] }>(
  { auth: true, expose: true, method: "GET", path: "/api/tasks/missed-checks" },
  async (req) => {
    const days = Math.min(31, Math.max(1, Number(req.days) || 7));
    // due_at is set on every check the shift-board generator makes; the old
    // generator's leftovers (retired by migration 068) have none.
    const rows = await db.rawQueryAll<{ id: number; title: string; d: Date | string; shift: string; per_shift: boolean | null; rrule: string | null }>(
      `SELECT t.id, t.title, i.generated_for_date AS d, i.generated_for_shift AS shift, tt.per_shift, tt.rrule
       FROM tasks t
       JOIN task_template_instances i ON i.task_id = t.id
       LEFT JOIN task_templates tt ON tt.id = i.template_id
       WHERE t.source_type = 'template' AND t.status = 'Missed' AND t.due_at IS NOT NULL
         AND t.due_at > NOW() - make_interval(days => $1::int)
       ORDER BY t.due_at DESC`,
      days
    );
    return {
      checks: rows.map((r) => {
        const date = r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10);
        const freq = checkFreq(r.per_shift, r.rrule);
        const slots = r.shift
          ? [shiftSlot(date, r.shift as SlotType)]
          : freq === "daily" ? [shiftSlot(date, "day"), shiftSlot(date, "night")] : [];
        const watches = [...new Set(slots.map((s) => watchForSlot(s)?.watch).filter((w): w is string => !!w))];
        return { id: r.id, title: r.title, date, shift: r.shift, freq, watches };
      }),
    };
  }
);
