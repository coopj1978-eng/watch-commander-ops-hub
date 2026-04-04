import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateTaskRequest, Task } from "./types";

export const create = api<CreateTaskRequest, Task>(
  { auth: true, expose: true, method: "POST", path: "/tasks" },
  async (req) => {
    const auth = getAuthData()!;

    // Derive watch_unit: use explicit value, or fall back to creator's watch
    let watchUnit = req.watch_unit ?? null;
    if (!watchUnit) {
      const creator = await db.rawQueryRow<{ watch_unit: string }>(
        `SELECT watch_unit FROM users WHERE id = $1`, auth.userID
      );
      watchUnit = creator?.watch_unit ?? null;
    }

    const task = await db.rawQueryRow<Task>(
      `INSERT INTO tasks (title, description, assigned_to_user_id, assigned_by, priority, due_at, category, checklist, attachments, rrule, tags, watch_unit, source_type, source_id, calendar_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      req.title,
      req.description ?? null,
      req.assigned_to ?? null,
      req.assigned_by,
      req.priority ?? "Med",
      req.due_date ?? null,
      req.category,
      JSON.stringify(req.checklist ?? []),
      req.attachments ?? null,
      req.rrule ?? null,
      req.tags ?? null,
      watchUnit,
      req.source_type ?? null,
      req.source_id ?? null,
      req.calendar_event_id ?? null,
    );

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
