import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

interface DeleteTaskRequest {
  id: number;
}

export const deleteTask = api<DeleteTaskRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/tasks/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    await db.exec`DELETE FROM tasks WHERE id = ${id}`;

    await logActivity({
      user_id: auth.userID,
      action: "delete_task",
      entity_type: "task",
      entity_id: id.toString(),
      details: {},
    });
  }
);
