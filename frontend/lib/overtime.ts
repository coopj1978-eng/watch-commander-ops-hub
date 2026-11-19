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
