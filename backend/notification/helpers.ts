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
