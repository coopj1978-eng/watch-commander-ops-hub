import { api } from "encore.dev/api";
import type { ActivityLog, CreateActivityLogRequest } from "./types";

export const createActivityLog = api<CreateActivityLogRequest, ActivityLog>(
  { method: "POST", path: "/admin/activity-log", expose: true },
  async (req) => {
    const newLog: ActivityLog = {
      id: Math.floor(Math.random() * 10000),
      actor_user_id: req.actor_user_id,
      action: req.action,
      entity_type: req.entity_type,
      entity_id: req.entity_id,
      timestamp: new Date(),
      metadata: req.metadata,
    };

    return newLog;
  }
);
