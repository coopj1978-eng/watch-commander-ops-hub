import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export interface TodaySickMember {
  user_id: string;
  name: string;
  watch_unit: string | null;
}

interface TodaySickResponse {
  sick_staff: TodaySickMember[];
}

/**
 * Returns all staff with an approved sickness absence that covers today's date.
 * Used by the WC dashboard to cross-reference against the crewing board.
 */
export const todaySick = api<void, TodaySickResponse>(
  { auth: true, expose: true, method: "GET", path: "/absences/today-sick" },
  async () => {
    getAuthData()!;

    const today = new Date().toISOString().split("T")[0];

    const rows = await db.rawQueryAll<TodaySickMember>(
      `SELECT u.id AS user_id, u.name, u.watch_unit
       FROM absences a
       JOIN users u ON u.id = a.firefighter_id
       WHERE a.type = 'sickness'
         AND a.status = 'approved'
         AND a.start_date::date <= $1::date
         AND a.end_date::date   >= $1::date
       ORDER BY u.name`,
      today
    );

    return { sick_staff: rows };
  }
);
