import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import db from "../db";
import type { UserRole } from "../user/types";
import { createActivityLog } from "./create_activity_log";

export interface ChangeRoleRequest {
  userId: string;
  newRole: UserRole;
}

export const changeRole = api(
  { method: "PUT", path: "/api/admin/users/:userId/role", expose: true, auth: true },
  async ({ userId, newRole }: ChangeRoleRequest): Promise<void> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC");

    const userRow = await db.rawQueryRow<{ id: string; role: string; is_active: boolean }>(
      `SELECT id, role, is_active FROM users WHERE id = $1`,
      userId
    );

    if (!userRow) {
      throw APIError.notFound("User not found");
    }

    if (userRow.role === "WC" && newRole !== "WC") {
      const activeWCCount = await db.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM users WHERE role = 'WC' AND is_active = true AND id != $1`,
        userId
      );
      if (activeWCCount?.count === 0) {
        throw APIError.invalidArgument(
          "Cannot demote the last active Watch Commander. At least one WC must remain."
        );
      }
    }

    await db.rawExec(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
      newRole,
      userId
    );

    await createActivityLog({
      actor_user_id: auth.userID,
      action: "change_role",
      entity_type: "user",
      entity_id: userId,
      metadata: {
        old_role: userRow.role,
        new_role: newRole,
      },
    });
  }
);
