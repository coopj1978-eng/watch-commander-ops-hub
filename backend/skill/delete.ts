import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { hasPermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";

interface DeleteSkillRenewalRequest {
  id: number;
}

export const deleteSkillRenewal = api<DeleteSkillRenewalRequest, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/skills/renewals/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const skill = await db.queryRow<{ profile_id: number; user_id: string }>`
      SELECT sr.profile_id, fp.user_id
      FROM skill_renewals sr
      JOIN firefighter_profiles fp ON sr.profile_id = fp.id
      WHERE sr.id = ${id}
    `;

    if (!skill) {
      throw APIError.notFound("skill renewal not found");
    }

    const canEditAllProfiles = hasPermission(auth, Permission.EDIT_ALL_PROFILES);
    const canEditOwnProfile = hasPermission(auth, Permission.EDIT_OWN_PROFILE) && skill.user_id === auth.userID;
    const canEditAssignedFirefighters = hasPermission(auth, Permission.EDIT_ASSIGNED_FIREFIGHTERS);

    if (!canEditAllProfiles && !canEditOwnProfile && !canEditAssignedFirefighters) {
      throw APIError.permissionDenied("You don't have permission to delete this skill");
    }

    await db.exec`
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
