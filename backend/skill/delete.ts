import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";

interface DeleteSkillRenewalRequest {
  id: number;
}

export const deleteSkillRenewal = api<DeleteSkillRenewalRequest, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/skills/renewals/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.EDIT_ALL_PROFILES);

    const result = await db.exec`
      DELETE FROM skill_renewals WHERE id = ${id}
    `;

    await logActivity({
      user_id: auth.userID,
      action: "delete_skill_renewal",
      entity_type: "skill_renewal",
      entity_id: id.toString(),
      details: {},
    });

    return { success: true };
  }
);
