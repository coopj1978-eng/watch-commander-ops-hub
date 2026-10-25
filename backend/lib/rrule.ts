import { ukTodayIso } from "./sicknessMath";

/**
 * RRULE matching for the template task generator. No Encore imports, so it
 * can be unit-tested directly.
 *
 * Covers what the app builds (TaskTemplateManager, TaskDetailDrawer presets)
 * plus the RFC 5545 bits a hand-typed custom rule is likely to use:
 *   FREQ=DAILY | WEEKLY | MONTHLY, INTERVAL, BYDAY (DAILY/WEEKLY), WKST,
 *   BYMONTHDAY (MONTHLY; negatives count back from the month end) and an
 *   optional DTSTART ("DTSTART:20261026" on its own line, or a DTSTART= part).
 *
 * INTERVAL is counted from an anchor day — the rule's DTSTART if it has one,
 * otherwise the UK day the template was created — so "every 2 weeks" lands
 * on the same alternating weeks on every run. As in RFC 5545 the day/week/
 * month containing the anchor is period 0, and nothing fires before it.
 */

const DAY_MS = 86_400_000;
const DAY_NAMES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** YYYY-MM-DD → whole days since 1970-01-01. */
function isoToDay(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
}

/** 0=Sun … 6=Sat (1970-01-01 was a Thursday). */
function weekdayOf(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

function dtstartIso(value: string): string | null {
  const m = value.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseRule(rrule: string): { parts: Record<string, string>; dtstart: string | null } {
  const parts: Record<string, string> = {};
  let dtstart: string | null = null;
  for (const raw of rrule.split(/\r?\n/)) {
    const line = raw.trim();
    // RFC form: "DTSTART:20261026T090000Z" or "DTSTART;TZID=Europe/London:20261026T090000"
    const dtLine = line.match(/^DTSTART[^:]*:(.*)$/i);
    if (dtLine) {
      dtstart = dtstartIso(dtLine[1].trim());
      continue;
    }
    line.replace(/^RRULE:/i, "").split(";").forEach((part) => {
      const [key, val] = part.split("=");
      if (key && val) parts[key.trim().toUpperCase()] = val.trim().toUpperCase();
    });
  }
  if (!dtstart && parts["DTSTART"]) dtstart = dtstartIso(parts["DTSTART"]);
  return { parts, dtstart };
}

/**
 * Whether a template's rule fires on the given UK calendar day (YYYY-MM-DD).
 * `templateCreatedAt` is the fallback anchor when the rule has no DTSTART.
 */
export function rruleFiresOn(rrule: string, dateIso: string, templateCreatedAt?: Date | string | null): boolean {
  const { parts, dtstart } = parseRule(rrule);
  const freq = parts["FREQ"];
  if (!freq) return false;

  const interval = Math.max(1, parseInt(parts["INTERVAL"] ?? "1") || 1);

  const created = templateCreatedAt ? new Date(templateCreatedAt) : null;
  const createdIso = created && !Number.isNaN(created.getTime()) ? ukTodayIso(created) : null;
  const anchorIso = dtstart ?? createdIso;
  // With no anchor at all, count periods from 1970 — arbitrary but stable.
  const anchor = anchorIso ? isoToDay(anchorIso) : 0;

  const day = isoToDay(dateIso);
  if (anchorIso && day < anchor) return false;

  const weekday = weekdayOf(day);
  const byDay = parts["BYDAY"]?.split(",").map((d) => d.trim()).filter(Boolean);

  if (freq === "DAILY") {
    if (byDay && !byDay.includes(DAY_NAMES[weekday])) return false;
    return (day - anchor) % interval === 0;
  }

  if (freq === "WEEKLY") {
    // No BYDAY: once a week, on the anchor's weekday (Monday if unknown).
    const days = byDay ?? [DAY_NAMES[anchorIso ? weekdayOf(anchor) : 1]];
    if (!days.includes(DAY_NAMES[weekday])) return false;
    const wkst = DAY_NAMES.indexOf(parts["WKST"] ?? "");
    const weekStart = wkst >= 0 ? wkst : 1; // RFC default: weeks start on Monday
    const startOfWeek = (d: number) => d - ((weekdayOf(d) - weekStart + 7) % 7);
    const weeks = (startOfWeek(day) - startOfWeek(anchor)) / 7;
    return weeks % interval === 0;
  }

  if (freq === "MONTHLY") {
    const [y, m, d] = dateIso.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // No BYMONTHDAY: DTSTART's day if given, otherwise the 1st (the original default).
    const monthDays = parts["BYMONTHDAY"]
      ? parts["BYMONTHDAY"]
          .split(",")
          .map((v) => parseInt(v))
          .filter(Number.isFinite)
          .map((v) => (v < 0 ? daysInMonth + v + 1 : v))
      : [dtstart ? +dtstart.slice(8, 10) : 1];
    if (!monthDays.includes(d)) return false;
    const anchorMonth = anchorIso ? +anchorIso.slice(0, 4) * 12 + +anchorIso.slice(5, 7) : 1970 * 12 + 1;
    return (y * 12 + m - anchorMonth) % interval === 0;
  }

  return false;
}
