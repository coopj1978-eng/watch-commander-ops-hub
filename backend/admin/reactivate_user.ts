import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import db from "../db";
import { createActivityLog } from "./create_activity_log";

export interface ReactivateUserRequest {
  userId: string;
}

export const reactivateUser = api(
  { method: "POST", path: "/api/admin/users/:userId/reactivate", expose: true, auth: true },
  async ({ userId }: ReactivateUserRequest): Promise<void> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC");

    const userRow = await db.rawQueryRow<{ id: string; is_active: boolean }>(
      `SELECT id, is_active FROM users WHERE id = $1`,
      userId
    );

    if (!userRow) {
      throw APIError.notFound("User not found");
    }

    if (userRow.is_active) {
      throw APIError.invalidArgument("User is already active");
    }

    await db.rawExec(
      `UPDATE users SET is_active = true, left_at = NULL, updated_at = NOW() WHERE id = $1`,
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
