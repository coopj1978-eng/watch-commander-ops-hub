import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { MarkReadResponse } from "./types";

interface MarkReadRequest {
  notification_id: number;
}

export const markRead = api(
  { auth: true, expose: true, method: "POST", path: "/notifications/:notification_id/read" },
  async ({ notification_id }: MarkReadRequest): Promise<MarkReadResponse> => {
    const auth = getAuthData()!;

    await db.exec`
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = ${notification_id}
        AND user_id = ${auth.userID}
    `;

    return { success: true };
  }
);
