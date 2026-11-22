import { api, APIError, Query } from "encore.dev/api";
import db, { type SQLPrimitive } from "../db";
import { ukTodayIso } from "../lib/sickness";
import { absenceViewer, visibleAbsencesSql } from "../lib/absenceAccess";

export interface TodaySickMember {
  user_id: string;
  name: string;
  watch_unit: string | null;
  /**
   * Their open sickness — lets their WC/CC book them back fit. Null if a
   * return date is already booked.
   */
  absence_id: number | null;
}

interface TodaySickRequest {
  /** YYYY-MM-DD; defaults to today (UK). */
  date?: Query<string>;
}

interface TodaySickResponse {
  sick_staff: TodaySickMember[];
}

/**
 * Who is off sick on a date — names only, no reason, dates or history.
 *
 * A WC/CC gets their own watch only (John, 22 Nov 2026 — it used to be the
 * whole station so that someone covering from another watch showed as sick
 * on their board; he'd rather not be told about other watches at all). An
 * admin who isn't on a watch gets everyone; a firefighter only ever sees
 * themself. The same rule as the records themselves (lib/absenceAccess).
 * Used by the crewing board, the People page and the dashboard's
 * crewing-gap alert.
 */
export const todaySick = api<TodaySickRequest, TodaySickResponse>(
  { auth: true, expose: true, method: "GET", path: "/absences/today-sick" },
  async (req) => {
    const viewer = await absenceViewer();

    const day = req.date ?? ukTodayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw APIError.invalidArgument("date must be YYYY-MM-DD");
    }

    // Sickness counts as covering the day when:
    //   • start_date is on or before it, AND
    //   • either the original end_date covers it, OR the FF hasn't
    //     been booked back fit yet (returned_to_work_at IS NULL — the
    //     end_date is just the WC's expected return; the FF stays sick
    //     until explicitly closed out).
    const params: SQLPrimitive[] = [day];
    const mayKnow = visibleAbsencesSql(viewer, "a.firefighter_id", params);
    const rows = await db.rawQueryAll<TodaySickMember>(
      `SELECT u.id AS user_id, u.name, u.watch_unit, (MAX(a.id) FILTER (WHERE a.returned_to_work_at IS NULL))::int AS absence_id
       FROM absences a
       JOIN users u ON u.id = a.firefighter_id
       WHERE a.type = 'sickness'
         AND a.status = 'approved'
         AND a.start_date::date <= $1::date
         AND (a.end_date::date >= $1::date OR a.returned_to_work_at IS NULL)
         AND (a.returned_to_work_at IS NULL OR a.returned_to_work_at::date > $1::date)
         AND ${mayKnow}
       GROUP BY u.id, u.name, u.watch_unit
       ORDER BY u.name`,
      ...params
    );

    return { sick_staff: rows };
  }
);
