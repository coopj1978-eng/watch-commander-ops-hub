import type { Task } from "~backend/task/types";
import { getLabelById } from "./taskLabels";

// The Tasks page's Upcoming list (components/TaskSidePanel.tsx): the watch's
// open tasks, its Watch Calendar events and Station events. Personal events
// never come here.

export interface CalEvent { id: number; title: string; start: Date; allDay: boolean; station: boolean }

export interface UpcomingItem {
  key: string;
  kind: "over" | "soon" | "ev" | "station" | "plain";
  tag: string;
  when: string;
  title: string;
  at: number;
  date: string;
  task?: Task;
}

export const UPCOMING_MAX = 8;

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const daysFromToday = (d: Date, now: Date = new Date()) =>
  Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Overdue first, then the next tasks, watch events and station events by date. */
export function buildUpcoming(tasks: Task[], events: CalEvent[], now: Date = new Date()): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const t of tasks) {
    if (!t.due_at || t.status === "Done") continue;
    const due = new Date(t.due_at);
    const diff = daysFromToday(due, now);
    const label = (t.tags ?? []).map(getLabelById).find(Boolean)?.name ?? (t.category && t.category !== "Other" ? t.category : "Task");
    const rel = diff < 0 ? `Overdue ${-diff}d` : diff === 0 ? "Today" : diff <= 3 ? `In ${diff}d` : "";
    items.push({
      key: `t${t.id}`, kind: diff < 0 ? "over" : diff <= 3 ? "soon" : "plain",
      tag: rel ? `${label} · ${rel}` : label, when: shortDate(due), title: t.title,
      at: diff < 0 ? -1e15 + due.getTime() : startOfDay(due).getTime(), date: dayKey(due), task: t,
    });
  }
  // A Station event puts a task on the board of the watch on duty; that task
  // already stands for it, so the event isn't listed twice.
  const linked = new Set(tasks.map((t) => t.calendar_event_id).filter(Boolean));
  for (const e of events) {
    if (e.start.getTime() < now.getTime() - (e.allDay ? 86400000 : 0)) continue;
    if (linked.has(e.id)) continue;
    const diff = daysFromToday(e.start, now);
    const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : shortDate(e.start);
    items.push({
      key: `e${e.id}`, kind: e.station ? "station" : "ev", tag: e.station ? "Station" : "Watch Calendar",
      when: e.allDay ? `${day} · all day` : `${day} ${hhmm(e.start)}`,
      title: e.title, at: e.start.getTime(), date: dayKey(e.start),
    });
  }
  return items.sort((a, b) => a.at - b.at).slice(0, UPCOMING_MAX);
}
