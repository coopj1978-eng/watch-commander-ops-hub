import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import db from "../db";
import { createActivityLog } from "./create_activity_log";

export interface DeactivateUserRequest {
  userId: string;
  deactivationDate: Date;
  reason?: string;
}

export const deactivateUser = api(
  { method: "POST", path: "/api/admin/users/:userId/deactivate", expose: true, auth: true },
  async ({ userId, deactivationDate, reason }: DeactivateUserRequest): Promise<void> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC");

    if (userId === auth.userID) {
      throw APIError.invalidArgument("Cannot deactivate your own account");
    }

    const userRow = await db.rawQueryRow<{ id: string; role: string; is_active: boolean }>(
      `SELECT id, role, is_active FROM users WHERE id = $1`,
      userId
    );

    if (!userRow) {
      throw APIError.notFound("User not found");
    }

    if (!userRow.is_active) {
      throw APIError.invalidArgument("User is already deactivated");
    }

    if (userRow.role === "WC") {
      const activeWCCount = await db.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM users WHERE role = 'WC' AND is_active = true AND id != $1`,
        userId
      );
      if (activeWCCount?.count === 0) {
        throw APIError.invalidArgument(
          "Cannot deactivate the last active Watch Commander. At least one WC must remain."
        );
      }
    }

    await db.rawExec(
      `UPDATE users SET is_active = false, left_at = $1, updated_at = NOW() WHERE id = $2`,
      deactivationDate,
      userId
    );

    await createActivityLog({
      actor_user_id: auth.userID,
      action: "deactivate_user",
      entity_type: "user",
      entity_id: userId,
      metadata: {
        deactivation_date: deactivationDate,
        reason,
      },
    });
  }
);
