import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { Task, TaskStatus, TaskPriority } from "./types";

interface ListTasksRequest {
  assigned_to?: Query<string>;
  watch_unit?:  Query<string>;
  assigned_by?: Query<string>;
  status?:      Query<TaskStatus>;
  priority?:    Query<TaskPriority>;
  limit?:       Query<number>;
  offset?:      Query<number>;
}

interface ListTasksResponse {
  tasks: Task[];
  total: number;
}

export const list = api<ListTasksRequest, ListTasksResponse>(
  { auth: true, expose: true, method: "GET", path: "/tasks" },
  async (req) => {
    const auth = getAuthData()!;
    const limit  = req.limit  ?? 200;
    const offset = req.offset ?? 0;

    const params: any[] = [];
    const conditions: string[] = [];
    let   paramIndex = 1;

    if (req.assigned_to) {
      // Explicit person filter (used by personal calendar view)
      conditions.push(`assigned_to_user_id = $${paramIndex++}`);
      params.push(req.assigned_to);
    } else if (req.watch_unit) {
      // Explicit watch filter
      conditions.push(`watch_unit = $${paramIndex++}`);
      params.push(req.watch_unit);
    } else {
      // Default: show all tasks for the requesting user's watch
      const userRow = await db.rawQueryRow<{ watch_unit: string }>(
        `SELECT watch_unit FROM users WHERE id = $1`, auth.userID
      );
      if (userRow?.watch_unit) {
        conditions.push(`watch_unit = $${paramIndex++}`);
        params.push(userRow.watch_unit);
      } else if (auth.role === "FF") {
        // FF with no watch — fall back to their own tasks
        conditions.push(`assigned_to_user_id = $${paramIndex++}`);
        params.push(auth.userID);
      }
    }

    if (req.assigned_by) {
      conditions.push(`assigned_by = $${paramIndex++}`);
      params.push(req.assigned_by);
    }
    if (req.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(req.status);
    }
    if (req.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(req.priority);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    const query = `SELECT * FROM tasks${whereClause}
      ORDER BY
        CASE priority WHEN 'High' THEN 1 WHEN 'Med' THEN 2 WHEN 'Low' THEN 3 END,
        position ASC,
        due_at ASC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const rawTasks = await db.rawQueryAll<any>(query, ...params);
    const tasks: Task[] = rawTasks.map((t) => ({
      ...t,
      checklist:   typeof t.checklist === "string" ? JSON.parse(t.checklist) : t.checklist,
      attachments: Array.isArray(t.attachments) ? t.attachments : (t.attachments ?? undefined),
      tags:        Array.isArray(t.tags) ? t.tags : (t.tags ?? undefined),
    }));

    const countParams = params.slice(0, -2);
    const countResult = await db.rawQueryRow<{ count: string }>(
      `SELECT COUNT(*) as count FROM tasks${whereClause}`,
      ...countParams
    );

    return {
      tasks,
      total: Number(countResult?.count ?? 0),
    };
  }
);
