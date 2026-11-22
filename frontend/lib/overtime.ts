// Overtime (John, Nov 2026): logged from "Log shift" with its hours, and
// added up per calendar month for each person. Hours only — no pay.

export interface OvertimeBooking {
  type: string;
  start_date: string | Date;
  /** Postgres NUMERIC arrives as a string ("10.00"). */
  overtime_hours?: number | string | null;
}

export interface OvertimeMonth {
  /** "2026-11" */
  month: string;
  hours: number;
  /** How many overtime entries. */
  shifts: number;
}

const isoDay = (v: string | Date) => (typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10));

/** A full shift's hours: days are 08:00–18:00, nights 18:00–08:00. */
export const shiftHours = (dayNight: "Day" | "Night") => (dayNight === "Night" ? 14 : 10);

/** "10", "4.5" — no trailing ".0". */
export const hoursText = (h: number) => String(Math.round(h * 2) / 2);

/** "2026-11" → "November 2026". */
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** The calendar month a date falls in, "YYYY-MM". */
export const monthOf = (d: string | Date) => isoDay(d).slice(0, 7);

/** This month as "YYYY-MM" (local time). */
export function thisMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Overtime hours per month, newest first. Each entry counts in the month of
 * the date it was worked; months with none aren't listed.
 */
export function overtimeByMonth(bookings: OvertimeBooking[]): OvertimeMonth[] {
  const months = new Map<string, OvertimeMonth>();
  for (const b of bookings) {
    if (b.type !== "overtime") continue;
    const hours = Number(b.overtime_hours ?? 0);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const month = monthOf(b.start_date);
    const m = months.get(month) ?? { month, hours: 0, shifts: 0 };
    m.hours += hours;
    m.shifts += 1;
    months.set(month, m);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}

/** Hours in one month (0 if none). */
export const overtimeIn = (bookings: OvertimeBooking[], month: string) =>
  overtimeByMonth(bookings).find((m) => m.month === month)?.hours ?? 0;

// ── The whole watch for one month (John, 22 Nov 2026) ───────────────────────

export interface WatchOvertimeEntry {
  id: number;
  /** "2026-11-03" */
  date: string;
  hours: number;
  dayNight?: "Day" | "Night";
  /** The watch the shift was worked with. */
  withWatch?: string;
  notes?: string;
}

export interface WatchOvertimePerson {
  id: string;
  name: string;
  /** "WC" | "CC" | "FF" */
  role?: string;
  hours: number;
  entries: WatchOvertimeEntry[];
}

export interface WatchOvertime {
  /** Everyone on the watch: most hours first, then those with none, by name. */
  people: WatchOvertimePerson[];
  hours: number;
  entries: number;
  /** How many people have any. */
  withSome: number;
}

interface WatchBooking extends OvertimeBooking {
  id: number;
  user_id: string;
  shift_day_night?: "Day" | "Night" | null;
  covering_watch?: string | null;
  notes?: string | null;
}

/**
 * One month's overtime for everyone on a watch. Only the people on the
 * roster count (whichever watch the shift was worked with), each entry in
 * the month of the date it was worked; someone with none is still listed.
 */
export function watchOvertime(
  roster: { id: string; name: string; system_role?: string }[],
  bookings: WatchBooking[],
  month: string,
): WatchOvertime {
  const byPerson = new Map<string, WatchOvertimePerson>(
    roster.map((m) => [m.id, { id: m.id, name: m.name, role: m.system_role, hours: 0, entries: [] }]),
  );
  for (const b of bookings) {
    if (b.type !== "overtime" || monthOf(b.start_date) !== month) continue;
    const hours = Number(b.overtime_hours ?? 0);
    const person = byPerson.get(b.user_id);
    if (!person || !Number.isFinite(hours) || hours <= 0) continue;
    person.hours += hours;
    person.entries.push({
      id: b.id,
      date: isoDay(b.start_date),
      hours,
      dayNight: b.shift_day_night ?? undefined,
      withWatch: b.covering_watch ?? undefined,
      notes: b.notes ?? undefined,
    });
  }
  const people = [...byPerson.values()];
  for (const p of people) p.entries.sort((a, b) => a.date.localeCompare(b.date));
  people.sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  return {
    people,
    hours: people.reduce((n, p) => n + p.hours, 0),
    entries: people.reduce((n, p) => n + p.entries.length, 0),
    withSome: people.filter((p) => p.hours > 0).length,
  };
}

/** "2026-11" moved by whole months: monthShift("2026-01", -1) → "2025-12". */
export function monthShift(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** First and last day of a month, "YYYY-MM-DD". */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

const cell = (v: string | number | undefined) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The month as a spreadsheet: a line per entry, then a total per person. Hours only. */
export function watchOvertimeCsv(data: WatchOvertime): string {
  const lines = [["Name", "Date", "Shift", "Hours", "Worked with", "Note"].join(",")];
  for (const p of data.people) {
    for (const e of p.entries) {
      lines.push([p.name, e.date, e.dayNight ?? "", hoursText(e.hours), e.withWatch ? `${e.withWatch} Watch` : "", e.notes ?? ""].map(cell).join(","));
    }
  }
  lines.push("");
  lines.push(["Name", "Total hours", "Entries"].join(","));
  for (const p of data.people) if (p.hours > 0) lines.push([p.name, hoursText(p.hours), p.entries.length].map(cell).join(","));
  lines.push(["Watch total", hoursText(data.hours), data.entries].map(cell).join(","));
  return lines.join("\r\n");
}
