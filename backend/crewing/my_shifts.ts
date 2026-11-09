import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { addDaysIso, slotAt } from "../lib/shiftRota";
import { myShifts, type MyCrewing, type MyDetachment, type MyLeave, type MyOpenRequest, type MyShift } from "../lib/myShifts";
import type { StrengthAbsence, StrengthAdjustment } from "../lib/strength";

interface MyShiftsRequest {
  /** How many days ahead (default 14, at most 42). */
  days?: Query<number>;
}

interface MyShiftsResponse {
  watch: string | null;
  shifts: MyShift[];
  /** The watch's annual-leave block, when it's on now or starts in the window. */
  leave: MyLeave | null;
}

// Same statuses as shift-adjustments/requests.ts OPEN.
const OPEN = ["with_cover", "with_wc", "authorised", "referred"];

/**
 * GET /crewing/my-shifts — the caller's own next shifts for Home: the watch's
 * rota, with their own bookings, absences, seat and detachments applied
 * (lib/myShifts). Only ever the caller's records, so it's open to everyone.
 */
export const myShiftsApi = api<MyShiftsRequest, MyShiftsResponse>(
  { auth: true, expose: true, method: "GET", path: "/crewing/my-shifts" },
  async (req) => {
    const auth = getAuthData()!;
    const days = Math.min(42, Math.max(1, Math.floor(Number(req.days ?? 14)) || 14));
    const now = new Date();
    // From the shift running now (a night is dated the day it started).
    const from = slotAt(now).date;
    const to = addDaysIso(from, days);

    const me = await db.rawQueryRow<{ id: string; name: string; watch: string | null }>(
      `SELECT u.id, u.name, COALESCE(NULLIF(u.watch_unit, ''), NULLIF(p.watch, '')) AS watch
       FROM users u LEFT JOIN firefighter_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      auth.userID
    );
    if (!me) return { watch: null, shifts: [], leave: null };

    const [absences, adjustments, crewing, detachments, requests] = await Promise.all([
      db.rawQueryAll<StrengthAbsence>(
        `SELECT firefighter_id AS person, type, start_date::date::text AS start, end_date::date::text AS "end",
                returned_to_work_at::date::text AS back
         FROM absences
         WHERE status = 'approved' AND firefighter_id = $1
           AND start_date::date <= $3::date
           AND (end_date::date >= $2::date OR (type = 'sickness' AND returned_to_work_at IS NULL))`,
        me.id, from, to
      ),
      db.rawQueryAll<StrengthAdjustment>(
        `SELECT sa.user_id, u.name AS user_name, sa.type, sa.start_date::date::text AS start,
                sa.end_date::date::text AS "end", sa.shift_day_night AS day_night, sa.watch_unit,
                sa.covering_watch, sa.covering_user_id, sa.covering_name
         FROM shift_adjustments sa
         JOIN users u ON u.id = sa.user_id
         WHERE (sa.user_id = $1 OR sa.covering_user_id = $1)
           AND sa.start_date::date <= $3::date AND sa.end_date::date >= $2::date`,
        me.id, from, to
      ),
      db.rawQueryAll<MyCrewing>(
        `SELECT shift_date::text AS date, shift_type, watch, appliance, crew_role
         FROM shift_crewing
         WHERE user_id = $1 AND shift_date BETWEEN $2::date AND $3::date`,
        me.id, from, to
      ),
      db.rawQueryAll<MyDetachment>(
        `SELECT detachment_date::text AS date, to_station
         FROM detachments
         WHERE firefighter_id = $1 AND detachment_date BETWEEN $2::date AND $3::date`,
        me.id, from, to
      ),
      db.rawQueryAll<MyOpenRequest>(
        `SELECT type, shift_date::text AS date, day_night
         FROM shift_requests
         WHERE user_id = $1 AND status = ANY($2::text[]) AND shift_date BETWEEN $3::date AND $4::date`,
        me.id, OPEN, from, to
      ),
    ]);

    const { shifts, leave } = myShifts({
      me: { id: me.id, name: me.name },
      watch: me.watch,
      from, to, now,
      absences, adjustments, crewing, detachments, requests,
    });
    return { watch: me.watch, shifts, leave };
  }
);
