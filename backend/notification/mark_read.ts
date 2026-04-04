import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

interface MarkReadRequest {
  id: number;
}

export const markRead = api<MarkReadRequest, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/notifications/:id/read" },
  async ({ id }) => {
    const auth = getAuthData()!;

    await db.exec`
      UPDATE notifications
      SET read = TRUE
      WHERE id = ${id} AND user_id = ${auth.userID}
    `;

    return { success: true };
  }
);
