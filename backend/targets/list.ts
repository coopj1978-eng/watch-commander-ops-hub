import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { Target, TargetMetric, TargetStatus } from "./types";

interface ListTargetsRequest {
  metric?: Query<TargetMetric>;
  status?: Query<TargetStatus>;
  period_start?: Query<string>;
  period_end?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListTargetsResponse {
  targets: Target[];
  total: number;
}

export const list = api<ListTargetsRequest, ListTargetsResponse>(
  { expose: true, method: "GET", path: "/targets" },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM targets`;
    let countQuery = `SELECT COUNT(*) as count FROM targets`;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.metric) {
      conditions.push(`metric = $${paramIndex++}`);
      params.push(req.metric);
    }
    if (req.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(req.status);
    }
    if (req.period_start) {
      conditions.push(`period_start >= $${paramIndex++}`);
      params.push(req.period_start);
    }
    if (req.period_end) {
      conditions.push(`period_end <= $${paramIndex++}`);
      params.push(req.period_end);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY period_start DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const targets = await db.rawQueryAll<Target>(query, ...params);
    const countParams = params.slice(0, -2);
    const countResult = await db.rawQueryRow<{ count: number }>(countQuery, ...countParams);

    return {
      targets,
      total: countResult?.count || 0,
    };
  }
);
