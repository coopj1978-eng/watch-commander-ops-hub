import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { Absence, AbsenceStatus } from "./types";

interface ListAbsencesRequest {
  user_id?: Query<string>;
  status?: Query<AbsenceStatus>;
  start_date?: Query<string>;
  end_date?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListAbsencesResponse {
  absences: Absence[];
  total: number;
}

export const list = api<ListAbsencesRequest, ListAbsencesResponse>(
  { auth: true, expose: true, method: "GET", path: "/absences" },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM absences`;
    let countQuery = `SELECT COUNT(*) as count FROM absences`;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.user_id) {
      conditions.push(`firefighter_id = $${paramIndex++}`);
      params.push(req.user_id);
    }
    if (req.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(req.status);
    }
    // Interval-overlap semantics: return absences whose date range INTERSECTS
    // the requested window (not absences fully contained inside it). Every
    // caller passing the same date for both bounds — CrewOnWatchTable,
    // CrewingBoard, OperationalStatusBar, DashboardKPIs, etc. — actually
    // wants "absences active on this date", which means an absence starting
    // April 22 and ending April 30 must come back when the window is
    // April 26..April 26.
    //
    //   request window:  [req.start_date, req.end_date]
    //   absence window:  [a.start_date,   a.end_date]
    //   overlap iff:     a.start_date <= req.end_date AND a.end_date >= req.start_date
    //
    // Sickness exception: a sickness whose `returned_to_work_at` is NULL
    // is still open regardless of end_date — the FF hasn't been booked
    // back fit yet, so end_date is just the WC's original guess. Treat
    // those as active whenever start_date <= req.end_date.
    if (req.end_date) {
      conditions.push(`start_date <= $${paramIndex++}`);
      params.push(req.end_date);
    }
    if (req.start_date) {
      conditions.push(
        `(end_date >= $${paramIndex++} OR (type = 'sickness' AND returned_to_work_at IS NULL))`
      );
      params.push(req.start_date);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY start_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const absences = await db.rawQueryAll<Absence>(query, ...params);
    const countParams = params.slice(0, -2);
    const countResult = await db.rawQueryRow<{ count: number }>(countQuery, ...countParams);

    return {
      absences,
      total: countResult?.count || 0,
    };
  }
);
