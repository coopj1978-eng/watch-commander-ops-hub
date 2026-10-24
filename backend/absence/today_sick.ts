import { api } from "encore.dev/api";
import db from "../db";
import { absenceViewer, visibleAbsencesSql } from "../lib/absenceAccess";
import { ukTodayIso } from "../lib/sickness";

export interface TodaySickMember {
  user_id: string;
  name: string;
  watch_unit: string | null;
}

interface TodaySickResponse {
  sick_staff: TodaySickMember[];
}

/**
 * Returns staff with an approved sickness absence that covers today's date —
 * limited to the caller's own watch (or just themself for a firefighter).
 * Used by the WC dashboard to cross-reference against the crewing board.
 */
export const todaySick = api<void, TodaySickResponse>(
  { auth: true, expose: true, method: "GET", path: "/absences/today-sick" },
  async () => {
    const params: (string | number)[] = [ukTodayIso()];
    const visible = visibleAbsencesSql(await absenceViewer(), "a.firefighter_id", params);

    // Sickness counts as covering today when:
    //   • start_date is on or before today, AND
    //   • either the original end_date covers today, OR the FF hasn't
    //     been booked back fit yet (returned_to_work_at IS NULL — the
    //     end_date is just the WC's expected return; the FF stays sick
    //     until explicitly closed out).
    const rows = await db.rawQueryAll<TodaySickMember>(
      `SELECT u.id AS user_id, u.name, u.watch_unit
       FROM absences a
       JOIN users u ON u.id = a.firefighter_id
       WHERE a.type = 'sickness'
         AND a.status = 'approved'
         AND a.start_date::date <= $1::date
         AND (a.end_date::date >= $1::date OR a.returned_to_work_at IS NULL)
         AND (a.returned_to_work_at IS NULL OR a.returned_to_work_at::date > $1::date)
         AND ${visible}
       ORDER BY u.name`,
      ...params
    );

    return { sick_staff: rows };
  }
);
