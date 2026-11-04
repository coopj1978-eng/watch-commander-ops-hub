// Riding strength for one shift (Nov 2026): who on the watch is away, who is
// coming in to cover, and how many that leaves to ride. The same rules as the
// crewing board's picker, so the calendar count and the board agree:
//
//   away   — off sick (open until booked back fit), approved leave, an
//            outbound shift adjustment (Flexi, Training, H4H, TOIL) for that
//            day or night, or detached on the board;
//   covers — the named cover on an H4H/TOIL, and anyone booked onto this
//            watch from another (Flexi payback, Orange day).

/** B10P1 rides with 5, B10P2 with 4 (the crewing board's required seats). */
export const RIDE_ONE = 5;
export const RIDE_BOTH = 9;

export type AwayWhy = "Sick" | "Leave" | "Flexi" | "Training" | "H4H" | "TOIL" | "Detached";
export type CoverWhy = "H4H cover" | "TOIL cover" | "Flexi payback" | "Orange day";

export interface StrengthMember { id: string; name: string }

export interface StrengthAbsence {
  person: string;
  type: string;
  /** YYYY-MM-DD */
  start: string;
  end: string;
  /** Date booked back fit (sickness), or null while still open. */
  back: string | null;
}

export interface StrengthAdjustment {
  user_id: string;
  user_name: string;
  type: string;
  start: string;
  end: string;
  day_night: "Day" | "Night" | null;
  watch_unit: string | null;
  covering_watch: string | null;
  covering_user_id: string | null;
  covering_name: string | null;
}

export interface StrengthResult {
  total: number;
  available: number;
  away: { id: string; name: string; why: AwayWhy }[];
  covers: { id?: string; name: string; why: CoverWhy }[];
}

const OUTBOUND: Record<string, AwayWhy> = { flexi: "Flexi", training: "Training", h4h: "H4H", toil: "TOIL" };
const INBOUND: Record<string, CoverWhy> = { flexi_payback: "Flexi payback", orange_day: "Orange day" };

const same = (a: string | null, b: string) => !!a && a.toLowerCase() === b.toLowerCase();

/** Sickness runs until booked back fit; other leave runs its dates. */
function absenceCovers(a: StrengthAbsence, date: string): boolean {
  if (a.start > date) return false;
  if (a.type === "sickness") return (a.end >= date || a.back === null) && (a.back === null || a.back > date);
  return a.end >= date;
}

/** Adjustments with no Day/Night (older bookings) count for both. */
function adjustmentCovers(a: StrengthAdjustment, date: string, dayNight: "Day" | "Night"): boolean {
  return a.start <= date && a.end >= date && (!a.day_night || a.day_night === dayNight);
}

export function shiftStrength(input: {
  watch: string;
  date: string;
  dayNight: "Day" | "Night";
  roster: StrengthMember[];
  absences: StrengthAbsence[];
  adjustments: StrengthAdjustment[];
  detachedIds?: Set<string>;
}): StrengthResult {
  const { watch, date, dayNight, roster } = input;
  const onWatch = new Set(roster.map((m) => m.id));
  const why = new Map<string, AwayWhy>();
  const mark = (id: string, w: AwayWhy) => { if (onWatch.has(id) && !why.has(id)) why.set(id, w); };

  const absences = input.absences.filter((a) => absenceCovers(a, date));
  for (const a of absences) if (a.type === "sickness") mark(a.person, "Sick");
  for (const a of absences) if (a.type !== "sickness") mark(a.person, "Leave");

  const adjustments = input.adjustments.filter((a) => adjustmentCovers(a, date, dayNight));
  for (const a of adjustments) if (OUTBOUND[a.type]) mark(a.user_id, OUTBOUND[a.type]);
  for (const id of input.detachedIds ?? []) mark(id, "Detached");

  const covers: StrengthResult["covers"] = [];
  const seen = new Set<string>();
  const addCover = (id: string | null, name: string | null, w: CoverWhy) => {
    if (id && onWatch.has(id)) return; // already counted on the watch
    const key = id ?? (name ? `name:${name.toLowerCase()}` : "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    covers.push({ ...(id ? { id } : {}), name: name || "Cover", why: w });
  };
  for (const a of adjustments) {
    if ((a.type === "h4h" || a.type === "toil") && onWatch.has(a.user_id)) {
      addCover(a.covering_user_id, a.covering_name, a.type === "h4h" ? "H4H cover" : "TOIL cover");
    }
    if (INBOUND[a.type] && same(a.covering_watch, watch)) addCover(a.user_id, a.user_name, INBOUND[a.type]);
  }

  const names = new Map(roster.map((m) => [m.id, m.name]));
  const away = [...why].map(([id, w]) => ({ id, name: names.get(id) ?? "", why: w }));
  return { total: roster.length, available: roster.length - away.length + covers.length, away, covers };
}
