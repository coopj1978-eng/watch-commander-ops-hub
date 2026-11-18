import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requireAdmin } from "../auth/admin";
import { createActivityLog } from "./create_activity_log";

export interface ReactivateUserRequest {
  userId: string;
}

export const reactivateUser = api(
  { method: "POST", path: "/api/admin/users/:userId/reactivate", expose: true, auth: true },
  async ({ userId }: ReactivateUserRequest): Promise<void> => {
    const auth = getAuthData()!;
    requireAdmin(auth);

    const userRow = await db.rawQueryRow<{ id: string; left_at: Date | null }>(
      `SELECT id, left_at FROM users WHERE id = $1`,
      userId
    );

    if (!userRow) {
      throw APIError.notFound("User not found");
    }

    // Only someone marked as left comes back. A person who simply hasn't
    // signed up yet isn't "deactivated" — they use their invite link.
    if (!userRow.left_at) {
      throw APIError.invalidArgument("They haven't left the station");
    }

    // Back at the station; they can sign in again only if they ever signed up.
    await db.rawExec(
      `UPDATE users SET is_active = (password_hash IS NOT NULL), left_at = NULL, updated_at = NOW() WHERE id = $1`,
      userId
    );

    await createActivityLog({
      actor_user_id: auth.userID,
      action: "reactivate_user",
      entity_type: "user",
      entity_id: userId,
    });
  }
);
