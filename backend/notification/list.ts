import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { ListNotificationsResponse, Notification } from "./types";

export const list = api(
  { auth: true, expose: true, method: "GET", path: "/notifications" },
  async (): Promise<ListNotificationsResponse> => {
    const auth = getAuthData()!;

    const notifications: Notification[] = [];
    const query = db.query<Notification>`
      SELECT * FROM notifications
      WHERE user_id = ${auth.userID}
        AND due_date <= CURRENT_DATE
      ORDER BY due_date ASC, created_at DESC
      LIMIT 50
    `;
    
    for await (const notif of query) {
      notifications.push(notif);
    }

    const unreadCount = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ${auth.userID}
        AND is_read = FALSE
        AND due_date <= CURRENT_DATE
    `;

    return {
      notifications,
      unread_count: unreadCount?.count || 0,
    };
  }
);
