import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { assertCanModifyTask } from "./permissions";

interface DeleteTaskRequest {
  id: number;
}

export const deleteTask = api<DeleteTaskRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/api/tasks/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    await assertCanModifyTask(id);
    // Keep what it was in the log — a deleted task can't otherwise be traced.
    const gone = await db.queryRow<{ title: string; watch_unit: string | null; due_at: Date | null; status: string }>`
      DELETE FROM tasks WHERE id = ${id} RETURNING title, watch_unit, due_at, status
    `;

    await logActivity({
      user_id: auth.userID,
      action: "delete_task",
      entity_type: "task",
      entity_id: id.toString(),
      details: gone ? { title: gone.title, watch_unit: gone.watch_unit, due_at: gone.due_at, status: gone.status } : {},
    });
  }
);
