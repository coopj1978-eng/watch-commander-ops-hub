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
    if (req.start_date) {
      conditions.push(`start_date >= $${paramIndex++}`);
      params.push(req.start_date);
    }
    if (req.end_date) {
      conditions.push(`end_date <= $${paramIndex++}`);
      params.push(req.end_date);
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
