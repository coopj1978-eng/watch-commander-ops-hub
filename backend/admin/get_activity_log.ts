import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";
import type { ActivityLog } from "./types";

interface GetActivityLogRequest {
  user_id?: Query<string>;
  entity_type?: Query<string>;
  /** Substring match on action (case-insensitive). e.g. "crewing" matches add_crewing. */
  action?: Query<string>;
  /** ISO date string. Includes events on or after this date (UTC). */
  start_date?: Query<string>;
  /** ISO date string. Includes events strictly before this date (exclusive upper bound). */
  end_date?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

/**
 * One row in the audit log, enriched with the actor's display name so the UI
 * doesn't need a second round-trip per row to resolve `user_xxx_yyy` strings.
 */
interface ActivityLogRow extends ActivityLog {
  user_name: string | null;
}

interface GetActivityLogResponse {
  logs: ActivityLogRow[];
  total: number;
}

export const getActivityLog = api<GetActivityLogRequest, GetActivityLogResponse>(
  { auth: true, expose: true, method: "GET", path: "/admin/activity-log" },
  async (req) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.VIEW_ACTIVITY_LOG);

    const limit = Math.min(req.limit || 50, 200);
    const offset = req.offset || 0;

    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.user_id) {
      conditions.push(`al.user_id = $${paramIndex++}`);
      params.push(req.user_id);
    }
    if (req.entity_type) {
      conditions.push(`al.entity_type = $${paramIndex++}`);
      params.push(req.entity_type);
    }
    if (req.action) {
      conditions.push(`al.action ILIKE $${paramIndex++}`);
      params.push(`%${req.action}%`);
    }
    if (req.start_date) {
      conditions.push(`al.timestamp >= $${paramIndex++}::timestamptz`);
      params.push(req.start_date);
    }
    if (req.end_date) {
      conditions.push(`al.timestamp < $${paramIndex++}::timestamptz`);
      params.push(req.end_date);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    // LEFT JOIN so System events (no user_id) and rows pointing at deleted users
    // still appear — we render "System" / the raw id in those cases.
    const query =
      `SELECT al.*, u.name AS user_name
         FROM activity_log al
         LEFT JOIN users u ON al.user_id = u.id` +
      whereClause +
      ` ORDER BY al.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const queryParams = [...params, limit, offset];

    const countQuery = `SELECT COUNT(*) as count FROM activity_log al${whereClause}`;

    const logs = await db.rawQueryAll<ActivityLogRow>(query, ...queryParams);
    const countResult = await db.rawQueryRow<{ count: number }>(countQuery, ...params);

    return {
      logs,
      total: Number(countResult?.count ?? 0),
    };
  }
);
