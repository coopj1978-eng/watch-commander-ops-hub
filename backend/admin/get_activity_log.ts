import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";
import type { ActivityLog } from "./types";

interface GetActivityLogRequest {
  user_id?: Query<string>;
  entity_type?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface GetActivityLogResponse {
  logs: ActivityLog[];
  total: number;
}

export const getActivityLog = api<GetActivityLogRequest, GetActivityLogResponse>(
  { auth: true, expose: true, method: "GET", path: "/admin/activity-log" },
  async (req) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.VIEW_ACTIVITY_LOG);

    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM activity_log`;
    let countQuery = `SELECT COUNT(*) as count FROM activity_log`;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.user_id) {
      conditions.push(`actor_user_id = $${paramIndex++}`);
      params.push(req.user_id);
    }
    if (req.entity_type) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(req.entity_type);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const logs = await db.rawQueryAll<ActivityLog>(query, ...params);
    const countParams = params.slice(0, -2);
    const countResult = await db.rawQueryRow<{ count: number }>(countQuery, ...countParams);

    return {
      logs,
      total: countResult?.count || 0,
    };
  }
);
