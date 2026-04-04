import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export const markAllRead = api<void, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/notifications/read-all" },
  async () => {
    const auth = getAuthData()!;

    await db.exec`
      UPDATE notifications
      SET read = TRUE
      WHERE user_id = ${auth.userID} AND read = FALSE
    `;

    return { success: true };
  }
);
