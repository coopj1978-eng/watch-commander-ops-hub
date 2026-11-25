// What the shift date picker shows and lets you pick (Nov 2026): the watch's
// own rota, day by day. A shift can be picked; a rest day can't; annual
// leave only where the form allows it (a Head for Head can swap a leave day).

import { getShiftForDate } from "./shiftRota";

export interface ShiftPickDay {
  /** "YYYY-MM-DD" */
  iso: string;
  kind: "day" | "night" | "leave" | null;
  /** "2nd Day", "1st Night", "Annual leave" — "" on a rest day. */
  label: string;
  canPick: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** One day on a watch's rota, as the picker sees it. */
export function shiftPick(watch: string, iso: string, allowLeave = false): ShiftPickDay {
  const [y, m, d] = iso.split("-").map(Number);
  const s = getShiftForDate(watch, new Date(y, m - 1, d));
  if (!s) return { iso, kind: null, label: "", canPick: false };
  if (s.isLeave) return { iso, kind: "leave", label: "Annual leave", canPick: allowLeave };
  if (!s.isWorking) return { iso, kind: null, label: "", canPick: false };
  return { iso, kind: /Night/.test(s.shiftType) ? "night" : "day", label: s.shiftType, canPick: true };
}

/**
 * The days to draw for a month: whole weeks, Monday first, so it starts with
 * the tail of the month before and ends with the start of the next.
 * `month` is 0–11.
 */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => isoOf(new Date(year, month, 1 - lead + i)));
}
