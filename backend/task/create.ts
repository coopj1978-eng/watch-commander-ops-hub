import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateTaskRequest, Task } from "./types";

export const create = api<CreateTaskRequest, Task>(
  { auth: true, expose: true, method: "POST", path: "/tasks" },
  async (req) => {
    const auth = getAuthData()!;
    const task = await db.queryRow<Task>`
      INSERT INTO tasks (title, description, assigned_to_user_id, assigned_by, priority, due_at, category, checklist, attachments, rrule, tags)
      VALUES (${req.title}, ${req.description}, ${req.assigned_to}, ${req.assigned_by}, ${req.priority || "Med"}, ${req.due_date}, ${req.category}, ${JSON.stringify(req.checklist || [])}, ${req.attachments}, ${req.rrule}, ${req.tags})
      RETURNING *
    `;

    if (!task) {
      throw new Error("Failed to create task");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_task",
      entity_type: "task",
      entity_id: task.id.toString(),
      details: { title: task.title, assigned_to: task.assigned_to_user_id },
    });

    return task;
  }
);
