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
