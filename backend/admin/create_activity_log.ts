import { api } from "encore.dev/api";
import db from "../db";
import type { ActivityLog, CreateActivityLogRequest } from "./types";

export const createActivityLog = api<CreateActivityLogRequest, ActivityLog>(
  { method: "POST", path: "/admin/activity-log", expose: true, auth: true },
  async (req) => {
    const log = await db.queryRow<ActivityLog>`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
      VALUES (${req.actor_user_id}, ${req.action}, ${req.entity_type}, ${req.entity_id}, ${JSON.stringify(req.metadata || {})})
      RETURNING *
    `;

    if (!log) {
      throw new Error("Failed to create activity log");
    }

    return log;
  }
);
