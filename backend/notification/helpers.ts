import db from "../db";
import type { NotificationType } from "./types";

export interface CreateNotificationParams {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  link?: string;
}

/**
 * Creates an in-app notification for a user.
 * Import and call this from other services when a notable event occurs.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  await db.exec`
    INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, link)
    VALUES (
      ${params.user_id},
      ${params.type},
      ${params.title},
      ${params.message},
      ${params.entity_type ?? null},
      ${params.entity_id ?? null},
      ${params.link ?? null}
    )
  `;
}

/**
 * Notify the WCs and CCs of a watch (e.g. when someone from another watch
 * changes something of theirs). `exclude` skips the person who made the
 * change and anyone else who shouldn't get it. Never throws.
 */
export async function notifyWatchManagers(
  watch: string,
  exclude: string[],
  note: Omit<CreateNotificationParams, "user_id">
): Promise<void> {
  try {
    const managers = await db.rawQueryAll<{ id: string }>(
      `SELECT u.id FROM users u
       LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
       WHERE u.role IN ('WC', 'CC')
         AND u.left_at IS NULL
         AND LOWER(COALESCE(u.watch_unit, fp.watch)) = LOWER($1)
         AND NOT (u.id = ANY($2::text[]))`,
      watch,
      exclude
    );
    for (const m of managers) {
      await createNotification({ ...note, user_id: m.id });
    }
  } catch (err) {
    console.error(`Failed to notify ${watch} Watch managers:`, err);
  }
}
