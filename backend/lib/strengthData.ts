import db from "../db";
import type { StrengthAbsence, StrengthAdjustment, StrengthMember } from "./strength";
import { riderQuals, type RiderQuals } from "./ridingSeats";

/** Everything lib/strength needs for a watch over some dates. */
export async function loadStrengthData(watch: string, start: string, end: string) {
  // Same membership as /crewing/roster.
  const roster = await db.rawQueryAll<StrengthMember>(
    `SELECT u.id, u.name
     FROM users u
     LEFT JOIN firefighter_profiles p ON p.user_id = u.id
     WHERE u.left_at IS NULL
       AND u.role IN ('WC', 'CC', 'FF')
       AND (LOWER(u.watch_unit) = LOWER($1) OR LOWER(p.watch) = LOWER($1))`,
    watch
  );
  const ids = roster.map((m) => m.id);

  const [absences, adjustments, detached] = await Promise.all([
    db.rawQueryAll<StrengthAbsence>(
      `SELECT firefighter_id AS person, type, start_date::date::text AS start, end_date::date::text AS "end",
              returned_to_work_at::date::text AS back
       FROM absences
       WHERE status = 'approved'
         AND firefighter_id = ANY($1::text[])
         AND start_date::date <= $3::date
         AND (end_date::date >= $2::date OR (type = 'sickness' AND returned_to_work_at IS NULL))`,
      ids, start, end
    ),
    db.rawQueryAll<StrengthAdjustment>(
      `SELECT sa.user_id, u.name AS user_name, sa.type, sa.start_date::date::text AS start,
              sa.end_date::date::text AS "end", sa.shift_day_night AS day_night, sa.watch_unit,
              sa.covering_watch, sa.covering_user_id, sa.covering_name
       FROM shift_adjustments sa
       JOIN users u ON u.id = sa.user_id
       WHERE sa.start_date::date <= $3::date
         AND sa.end_date::date >= $2::date
         AND (sa.user_id = ANY($1::text[]) OR LOWER(sa.covering_watch) = LOWER($4))`,
      ids, start, end, watch
    ),
    db.rawQueryAll<{ date: string; shift_type: string; user_id: string }>(
      `SELECT shift_date::text AS date, shift_type, user_id
       FROM shift_crewing
       WHERE LOWER(watch) = LOWER($1) AND appliance = 'detached' AND user_id IS NOT NULL
         AND shift_date BETWEEN $2::date AND $3::date`,
      watch, start, end
    ),
  ]);

  // Crewing skills for everyone who could ride: the watch and anyone covering.
  const riderIds = [...new Set([
    ...ids,
    ...adjustments.flatMap((a) => [a.user_id, a.covering_user_id].filter((id): id is string => !!id)),
  ])];
  const qualRows = await db.rawQueryAll<{ id: string; role: string; rank: string | null; oic: boolean; driver_lgv: boolean; ba: boolean }>(
    `SELECT u.id, u.role, u.rank, COALESCE(p.oic, false) AS oic, COALESCE(p.driver_lgv, false) AS driver_lgv, COALESCE(p.ba, false) AS ba
     FROM users u LEFT JOIN firefighter_profiles p ON p.user_id = u.id
     WHERE u.id = ANY($1::text[])`,
    riderIds
  );
  const quals = new Map<string, RiderQuals>(qualRows.map((q) => [q.id, riderQuals(q)]));

  return { roster, absences, adjustments, detached, quals };
}
