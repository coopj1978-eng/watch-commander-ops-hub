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
    await db.exec`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
      VALUES (${params.user_id}, ${params.action}, ${params.entity_type}, ${params.entity_id}, ${JSON.stringify(params.details || {})})
    `;
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
