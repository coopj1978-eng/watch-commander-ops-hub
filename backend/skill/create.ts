import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { hasPermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";
import type { CreateSkillRenewalRequest, SkillRenewal } from "./types";

interface DBSkillRenewal {
  id: number;
  profile_id: number;
  skill_name: string;
  acquired_date?: Date;
  renewal_date?: Date;
  expiry_date?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export const create = api<CreateSkillRenewalRequest, SkillRenewal>(
  { auth: true, expose: true, method: "POST", path: "/skills/renewals" },
  async (req) => {
    const auth = getAuthData()!;

    const profile = await db.queryRow<{ user_id: string }>`
      SELECT user_id FROM firefighter_profiles WHERE id = ${req.profile_id}
    `;

    if (!profile) {
      throw APIError.notFound("profile not found");
    }

    const canEditAllProfiles = hasPermission(auth, Permission.EDIT_ALL_PROFILES);
    const canEditOwnProfile = hasPermission(auth, Permission.EDIT_OWN_PROFILE) && profile.user_id === auth.userID;
    const canEditAssignedFirefighters = hasPermission(auth, Permission.EDIT_ASSIGNED_FIREFIGHTERS);

    if (!canEditAllProfiles && !canEditOwnProfile && !canEditAssignedFirefighters) {
      throw APIError.permissionDenied("You don't have permission to add skills to this profile");
    }

    const dbSkill = await db.queryRow<DBSkillRenewal>`
      INSERT INTO skill_renewals (
        profile_id, skill_name, acquired_date, renewal_date, expiry_date, reminder_date, notes
      )
      VALUES (
        ${req.profile_id},
        ${req.skill_name},
        ${req.acquired_date ? new Date(req.acquired_date) : null},
        ${req.renewal_date ? new Date(req.renewal_date) : null},
        ${req.expiry_date ? new Date(req.expiry_date) : null},
        ${req.reminder_date ? new Date(req.reminder_date) : null},
        ${req.notes || null}
      )
      RETURNING *
    `;

    if (!dbSkill) {
      throw new Error("Failed to create skill renewal");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_skill_renewal",
      entity_type: "skill_renewal",
      entity_id: dbSkill.id.toString(),
      details: { profile_id: req.profile_id, skill_name: req.skill_name },
    });

    return dbSkill as SkillRenewal;
  }
);
