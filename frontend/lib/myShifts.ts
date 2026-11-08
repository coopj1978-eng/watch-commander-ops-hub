// Your own shifts (Nov 2026). John: "the FF default calendar should be theirs,
// with the watch's next". The watch's rota says when the watch is on; your
// own bookings change that for you:
//   off — Flexi day, Training, H4H (someone covers you) or TOIL on one of your
//         watch's shifts;
//   in  — an extra shift: covering someone's H4H/TOIL, or a Flexi payback /
//         Orange day on another watch.
// The same booking types the riding count uses (backend/lib/strength.ts).

export type DayNight = "Day" | "Night";

export interface MyBooking {
  type: string;
  start_date: string | Date;
  end_date: string | Date;
  shift_day_night?: DayNight | null;
  user_id: string;
  user_name?: string | null;
  covering_user_id?: string | null;
  covering_name?: string | null;
  watch_unit?: string | null;
  covering_watch?: string | null;
}

/** A Flexi/H4H request still going through (it becomes a booking once approved). */
export interface MyRequest {
  type: string;
  status: string;
  shift_date: string;
  day_night?: DayNight | null;
  user_id: string | null;
}

/** Statuses where the request is still waiting (backend shift-adjustments/requests.ts OPEN). */
const WAITING = new Set(["with_cover", "with_wc", "authorised", "referred"]);
const ASKED_LABEL: Record<string, string> = { flexi: "Flexi day", h4h: "H4H" };

export interface MyDay {
  /** off / in from a booking; asked = your request is still waiting. */
  state: "off" | "in" | "asked";
  /** "Flexi day", "H4H for Jo Bloggs · Red", "Orange day · Green"… */
  label: string;
  /** For an extra shift: day or night (unknown on older bookings). */
  shift?: DayNight;
}

const OFF_LABEL: Record<string, string> = { flexi: "Flexi day", training: "Training", h4h: "H4H", toil: "TOIL" };
const EXTRA_LABEL: Record<string, string> = { flexi_payback: "Flexi payback", orange_day: "Orange day" };

/** "YYYY-MM-DD" from a date-only value, whether a string or a Date at UTC midnight. */
export function isoDay(v: string | Date): string {
  return typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);
}

const covers = (b: MyBooking, day: string) => isoDay(b.start_date) <= day && isoDay(b.end_date) >= day;
const withWatch = (label: string, watch?: string | null) => (watch ? `${label} · ${watch}` : label);

/**
 * What each day means for you. Only days your bookings (or waiting requests)
 * change are in the map; anything else is the watch's rota as it stands. An
 * extra shift wins over being off, as it's where you'll actually be; a
 * booking wins over a request.
 */
export function myDays(
  bookings: MyBooking[],
  me: string,
  days: string[],
  watchShift: (day: string) => DayNight | null,
  requests: MyRequest[] = [],
): Map<string, MyDay> {
  const out = new Map<string, MyDay>();
  for (const day of days) {
    let extra: MyDay | undefined;
    let off: MyDay | undefined;
    for (const b of bookings) {
      if (!covers(b, day)) continue;
      const dn = b.shift_day_night ?? undefined;
      if ((b.type === "h4h" || b.type === "toil") && b.covering_user_id === me && b.user_id !== me) {
        const what = b.type === "h4h" ? "H4H" : "TOIL cover";
        extra ??= { state: "in", label: withWatch(b.user_name ? `${what} for ${b.user_name}` : what, b.watch_unit), shift: dn };
      } else if (EXTRA_LABEL[b.type] && b.user_id === me) {
        extra ??= { state: "in", label: withWatch(EXTRA_LABEL[b.type], b.covering_watch), shift: dn };
      } else if (OFF_LABEL[b.type] && b.user_id === me) {
        const mine = watchShift(day);
        // Off your own watch's shift: only when it's on, and the booking is
        // for that shift (older bookings without Day/Night count for both).
        if (!mine || (dn && dn !== mine)) continue;
        const label = b.type === "h4h" && b.covering_name ? `H4H · ${b.covering_name} covering` : OFF_LABEL[b.type];
        off ??= { state: "off", label };
      }
    }
    const asked = requests.find((r) => r.user_id === me && WAITING.has(r.status) && isoDay(r.shift_date) === day && ASKED_LABEL[r.type]);
    const note = extra ?? off ?? (asked ? { state: "asked" as const, label: ASKED_LABEL[asked.type], shift: asked.day_night ?? undefined } : undefined);
    if (note) out.set(day, note);
  }
  return out;
}
