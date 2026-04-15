import db from "../db";

interface LogActivityParams {
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    // Pass the raw object — Encore's driver serialises JS objects to jsonb
    // directly. Calling JSON.stringify first produced a jsonb *string* value
    // (the stringified payload got re-quoted), which broke -> / ->> / @> queries.
    await db.exec`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
      VALUES (${params.user_id}, ${params.action}, ${params.entity_type}, ${params.entity_id}, ${params.details || {}})
    `;
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
