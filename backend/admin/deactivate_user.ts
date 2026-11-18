import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requireAdmin } from "../auth/admin";
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
    requireAdmin(auth);

    if (userId === auth.userID) {
      throw APIError.invalidArgument("Cannot deactivate your own account");
    }

    const userRow = await db.rawQueryRow<{ id: string; role: string; left_at: Date | null }>(
      `SELECT id, role, left_at FROM users WHERE id = $1`,
      userId
    );

    if (!userRow) {
      throw APIError.notFound("User not found");
    }

    // "Left" is left_at. is_active only means they've signed up, so someone
    // who never signed in can still move away and be taken off the station.
    if (userRow.left_at) {
      throw APIError.invalidArgument("They're already marked as having left the station");
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

    // Off the crewing boards and the canteen rota from the day they go.
    const day = new Date(deactivationDate).toISOString().slice(0, 10);
    await db.rawExec(`DELETE FROM shift_crewing WHERE user_id = $1 AND shift_date >= $2::date`, userId, day);
    await db.rawExec(`DELETE FROM canteen_duties WHERE user_id = $1 AND shift_date >= $2::date`, userId, day);

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
