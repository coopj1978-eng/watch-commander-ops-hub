import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { Notification, ListNotificationsResponse } from "./types";

interface DBNotification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  link: string | null;
  read: boolean;
  created_at: Date;
}

function transform(row: DBNotification): Notification {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type as Notification["type"],
    title: row.title,
    message: row.message,
    entity_type: row.entity_type ?? undefined,
    entity_id: row.entity_id ?? undefined,
    link: row.link ?? undefined,
    read: row.read,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
  };
}

export const list = api<void, ListNotificationsResponse>(
  { auth: true, expose: true, method: "GET", path: "/notifications" },
  async () => {
    const auth = getAuthData()!;

    const rows = db.query<DBNotification>`
      SELECT * FROM notifications
      WHERE user_id = ${auth.userID}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const notifications: Notification[] = [];
    for await (const row of rows) {
      notifications.push(transform(row));
    }

    const unread_count = notifications.filter((n) => !n.read).length;

    return { notifications, unread_count };
  }
);
