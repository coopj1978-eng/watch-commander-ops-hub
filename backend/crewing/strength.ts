import { api, APIError, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import { absenceViewer } from "../lib/absenceAccess";
import { addDaysIso, watchShiftOn } from "../lib/shiftRota";
import { RIDE_BOTH, RIDE_ONE, shiftStrength, type AwayWhy, type CoverWhy } from "../lib/strength";
import { loadStrengthData } from "../lib/strengthData";

interface StrengthRequest {
  watch: Query<string>;
  /** YYYY-MM-DD, inclusive. */
  start_date: Query<string>;
  end_date: Query<string>;
}

export interface ShiftStrength {
  date: string;
  shift_type: string;
  total: number;
  available: number;
  /** No name on leave for a watch that isn't the viewer's own. */
  away: { name?: string; why: AwayWhy }[];
  covers: { name: string; why: CoverWhy }[];
}

interface StrengthResponse {
  watch: string;
  ride_one: number;
  ride_both: number;
  shifts: ShiftStrength[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /crewing/strength — how many each of a watch's shifts can ride, for
 * the calendar's riding count. WC/CC only, like strength on the home screen.
 *
 * Sickness names are shown station-wide (as on the crewing board, via
 * /absences/today-sick); names on leave only for the viewer's own watch,
 * since absence records belong to that watch's WC/CC (lib/absenceAccess).
 * Shift adjustments are on the watch calendar already, so they keep names.
 */
export const strength = api<StrengthRequest, StrengthResponse>(
  { auth: true, expose: true, method: "GET", path: "/crewing/strength" },
  async (req) => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");
    if (!ISO.test(req.start_date) || !ISO.test(req.end_date) || req.end_date < req.start_date) {
      throw APIError.invalidArgument("start_date and end_date must be YYYY-MM-DD, start first");
    }
    if (Date.parse(req.end_date) - Date.parse(req.start_date) > 400 * 86_400_000) {
      throw APIError.invalidArgument("Ask for a year or less at a time");
    }
    if (!watchShiftOn(req.watch, req.start_date)) throw APIError.invalidArgument("Unknown watch");

    const viewer = await absenceViewer();
    const ownWatch = !!viewer.watch && viewer.watch.toLowerCase() === req.watch.toLowerCase();

    const { roster, absences, adjustments, detached } = await loadStrengthData(req.watch, req.start_date, req.end_date);

    const shifts: ShiftStrength[] = [];
    for (let date = req.start_date; date <= req.end_date; date = addDaysIso(date, 1)) {
      const label = watchShiftOn(req.watch, date);
      if (!label || !/Day|Night/.test(label)) continue; // rest days and the leave block
      const r = shiftStrength({
        watch: req.watch,
        date,
        dayNight: label.includes("Night") ? "Night" : "Day",
        roster,
        absences,
        adjustments,
        detachedIds: new Set(detached.filter((d) => d.date === date && d.shift_type === label).map((d) => d.user_id)),
      });
      shifts.push({
        date,
        shift_type: label,
        total: r.total,
        available: r.available,
        away: r.away.map(({ name, why }) => (why === "Leave" && !ownWatch ? { why } : { name, why })),
        covers: r.covers.map(({ name, why }) => ({ name, why })),
      });
    }

    return { watch: req.watch, ride_one: RIDE_ONE, ride_both: RIDE_BOTH, shifts };
  }
);
