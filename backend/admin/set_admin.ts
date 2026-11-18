import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requireAdmin } from "../auth/admin";
import { ADMIN_RANK } from "../lib/station";
import { createActivityLog } from "./create_activity_log";

export interface SetAdminRequest {
  userId: string;
  isAdmin: boolean;
}

/**
 * Give or take away admin access (John, 18 Nov 2026: "the ability to add
 * admin access to any other user giving them WC profile with admin
 * access"). Only an admin can, only a Watch Commander can be given it, and
 * nobody can take away their own — so there is always an admin.
 */
export const setAdmin = api(
  { method: "PUT", path: "/api/admin/users/:userId/admin", expose: true, auth: true },
  async ({ userId, isAdmin }: SetAdminRequest): Promise<void> => {
    const auth = getAuthData()!;
    requireAdmin(auth);

    const row = await db.rawQueryRow<{ role: string; rank: string | null; is_admin: boolean | null; left_at: Date | null }>(
      `SELECT role, rank, is_admin, left_at FROM users WHERE id = $1`,
      userId
    );
    if (!row) throw APIError.notFound("User not found");
    if (!!row.is_admin === isAdmin) return;

    if (isAdmin) {
      if (row.left_at) throw APIError.failedPrecondition("They've left the station.");
      if (row.role !== "WC") {
        throw APIError.failedPrecondition("Only a Watch Commander can be given admin access. Change their rank first.");
      }
    } else {
      if (userId === auth.userID) {
        throw APIError.failedPrecondition("You can't take away your own admin access. Ask another admin.");
      }
      if (row.rank === ADMIN_RANK) {
        throw APIError.failedPrecondition("This is an Admin account. Change its rank first.");
      }
    }

    await db.rawExec(`UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2`, isAdmin, userId);

    await createActivityLog({
      actor_user_id: auth.userID,
      action: isAdmin ? "grant_admin" : "remove_admin",
      entity_type: "user",
      entity_id: userId,
    });
  }
);
