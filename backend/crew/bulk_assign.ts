import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { BulkTaskAssignment } from "./types";
import type { Task } from "../task/types";
import { logActivity } from "../logging/logger";

interface BulkAssignResponse {
  tasks: Task[];
}

export const bulkAssign = api<BulkTaskAssignment, BulkAssignResponse>(
  { auth: true, expose: true, method: "POST", path: "/crew/bulk-assign" },
  async (req) => {
    const auth = getAuthData();
    if (!auth) throw new Error("Unauthorized");

    const tasks: Task[] = [];

    for (let i = 0; i < req.assigned_to_ids.length; i++) {
      const userId = req.assigned_to_ids[i];
      const daysToAdd = i * req.stagger_days;
      const dueDate = new Date(req.start_date);
      dueDate.setDate(dueDate.getDate() + daysToAdd);

      const task = await db.rawQueryRow<Task>(
        `INSERT INTO tasks (
          title,
          description,
          category,
          assigned_to_user_id,
          status,
          priority,
          due_at,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, 'NotStarted', $5, $6, NOW(), NOW()
        )
        RETURNING *`,
        req.title,
        req.description || null,
        req.category,
        userId,
        req.priority || "Med",
        dueDate
      );

      if (!task) throw new Error("Failed to create task");
      tasks.push(task);

      await logActivity({
        user_id: auth.userID,
        action: "bulk_assign_task",
        entity_type: "task",
        entity_id: task.id.toString(),
        details: {
          title: req.title,
          assigned_to: userId,
          due_at: dueDate,
        },
      });
    }

    return { tasks };
  }
);
