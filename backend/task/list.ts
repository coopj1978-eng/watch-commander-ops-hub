import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { Task, TaskStatus, TaskPriority } from "./types";
import { filterByRole } from "../auth/rbac";

interface ListTasksRequest {
  assigned_to?: Query<string>;
  assigned_by?: Query<string>;
  status?: Query<TaskStatus>;
  priority?: Query<TaskPriority>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListTasksResponse {
  tasks: Task[];
  total: number;
}

export const list = api<ListTasksRequest, ListTasksResponse>(
  { auth: true, expose: true, method: "GET", path: "/tasks" },
  async (req) => {
    const auth = getAuthData()!;
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM tasks`;
    let countQuery = `SELECT COUNT(*) as count FROM tasks`;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (auth.role === "FF") {
      conditions.push(`assigned_to_user_id = $${paramIndex++}`);
      params.push(auth.userID);
    }

    if (req.assigned_to) {
      conditions.push(`assigned_to_user_id = $${paramIndex++}`);
      params.push(req.assigned_to);
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

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY 
      CASE priority 
        WHEN 'High' THEN 1 
        WHEN 'Med' THEN 2 
        WHEN 'Low' THEN 3 
      END,
      due_at ASC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const tasks = await db.rawQueryAll<Task>(query, ...params);
    const countParams = params.slice(0, -2);
    const countResult = await db.rawQueryRow<{ count: number }>(
      countQuery,
      ...countParams
    );

    return {
      tasks,
      total: countResult?.count || 0,
    };
  }
);
