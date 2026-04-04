import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateTaskRequest, Task } from "./types";

interface UpdateTaskParams {
  id: number;
}

export const update = api(
  { auth: true, expose: true, method: "PATCH", path: "/tasks/:id" },
  async (params: UpdateTaskParams & UpdateTaskRequest): Promise<Task> => {
    const { id, ...updates } = params;
    const auth = getAuthData()!;
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      queryParams.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      queryParams.push(updates.description);
    }
    if (updates.assigned_to !== undefined) {
      setClauses.push(`assigned_to_user_id = $${paramIndex++}`);
      queryParams.push(updates.assigned_to);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      queryParams.push(updates.status);
      if (updates.status === "Done") {
        setClauses.push(`completed_at = NOW()`);
      } else {
        setClauses.push(`completed_at = NULL`);
      }
    }
    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex++}`);
      queryParams.push(updates.priority);
    }
    if (updates.due_date !== undefined) {
      setClauses.push(`due_at = $${paramIndex++}`);
      queryParams.push(updates.due_date);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      queryParams.push(updates.category);
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${paramIndex++}`);
      queryParams.push(updates.tags);
    }
    if (updates.checklist !== undefined) {
      setClauses.push(`checklist = $${paramIndex++}`);
      queryParams.push(JSON.stringify(updates.checklist));
    }
    if (updates.attachments !== undefined) {
      setClauses.push(`attachments = $${paramIndex++}`);
      queryParams.push(updates.attachments);
    }
    if (updates.rrule !== undefined) {
      setClauses.push(`rrule = $${paramIndex++}`);
      queryParams.push(updates.rrule);
    }
    if (updates.position !== undefined) {
      setClauses.push(`position = $${paramIndex++}`);
      queryParams.push(updates.position);
    }
    if (updates.cover_colour !== undefined) {
      setClauses.push(`cover_colour = $${paramIndex++}`);
      queryParams.push(updates.cover_colour || null);
    }
    if (updates.watch_unit !== undefined) {
      setClauses.push(`watch_unit = $${paramIndex++}`);
      queryParams.push(updates.watch_unit || null);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("no updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    queryParams.push(id);

    const query = `
      UPDATE tasks
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const task = await db.rawQueryRow<Task>(query, ...queryParams);

    if (!task) {
      throw APIError.notFound("task not found");
    }

    // Cascade inspection completion when task moves to/from Done
    if (updates.status !== undefined && task) {
      const sourceInfo = await db.rawQueryRow<{ source_type: string | null; source_id: number | null }>(
        `SELECT source_type, source_id FROM tasks WHERE id = $1`,
        id
      );

      if (sourceInfo?.source_type && sourceInfo?.source_id) {
        const isDone = updates.status === "Done";

        if (sourceInfo.source_type === "hfsv") {
          await db.rawQueryRow(
            `UPDATE activity_records SET completed = $1, completed_at = $2, updated_at = NOW() WHERE id = $3`,
            isDone,
            isDone ? new Date() : null,
            sourceInfo.source_id
          );
        } else {
          const newStatus = isDone ? "complete" : "pending";
          await db.rawQueryRow(
            `UPDATE inspection_assignments SET status = $1, completed_at = $2, updated_at = NOW() WHERE id = $3`,
            newStatus,
            isDone ? new Date() : null,
            sourceInfo.source_id
          );

          if (sourceInfo.source_type === "multistory") {
            const assignment = await db.rawQueryRow<{ year: number }>(
              `SELECT year FROM inspection_assignments WHERE id = $1`,
              sourceInfo.source_id
            );
            if (assignment) {
              const countRow = await db.rawQueryRow<{ n: string }>(
                `SELECT COUNT(*) AS n FROM inspection_assignments WHERE plan_type = 'multistory' AND year = $1 AND status = 'complete'`,
                assignment.year
              );
              const completedCount = Number(countRow?.n ?? 0);
              await db.rawQueryAll(
                `UPDATE targets SET actual_count = $1, status = CASE WHEN $1 >= target_count THEN 'completed' WHEN $1::float / NULLIF(target_count,0) >= 0.8 THEN 'active' WHEN $1::float / NULLIF(target_count,0) >= 0.5 THEN 'at_risk' ELSE 'overdue' END, updated_at = NOW() WHERE metric = 'HighRise' AND EXTRACT(YEAR FROM period_start) = $2`,
                completedCount,
                assignment.year
              );
            }
          }
        }
      }
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_task",
      entity_type: "task",
      entity_id: id.toString(),
      details: updates,
    });

    return task;
  }
);
