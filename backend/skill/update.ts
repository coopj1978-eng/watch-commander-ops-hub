import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { hasPermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";
import type { UpdateSkillRenewalRequest, SkillRenewal } from "./types";

interface UpdateSkillRenewalParams {
  id: number;
}

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

export const update = api(
  { auth: true, expose: true, method: "PATCH", path: "/skills/renewals/:id" },
  async (params: UpdateSkillRenewalParams & UpdateSkillRenewalRequest): Promise<SkillRenewal> => {
    const { id, ...updates } = params;
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
      throw APIError.permissionDenied("You don't have permission to update this skill");
    }

    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.skill_name !== undefined) {
      setClauses.push(`skill_name = $${paramIndex++}`);
      queryParams.push(updates.skill_name);
    }
    if (updates.acquired_date !== undefined) {
      setClauses.push(`acquired_date = $${paramIndex++}`);
      queryParams.push(updates.acquired_date ? new Date(updates.acquired_date) : null);
    }
    if (updates.renewal_date !== undefined) {
      setClauses.push(`renewal_date = $${paramIndex++}`);
      queryParams.push(updates.renewal_date ? new Date(updates.renewal_date) : null);
    }
    if (updates.expiry_date !== undefined) {
      setClauses.push(`expiry_date = $${paramIndex++}`);
      queryParams.push(updates.expiry_date ? new Date(updates.expiry_date) : null);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      queryParams.push(updates.notes);
    }
    if (updates.reminder_date !== undefined) {
      setClauses.push(`reminder_date = $${paramIndex++}`);
      queryParams.push(updates.reminder_date ? new Date(updates.reminder_date) : null);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("no updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    queryParams.push(id);

    const query = `
      UPDATE skill_renewals
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const dbSkill = await db.rawQueryRow<DBSkillRenewal>(query, ...queryParams);

    if (!dbSkill) {
      throw APIError.notFound("skill renewal not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_skill_renewal",
      entity_type: "skill_renewal",
      entity_id: id.toString(),
      details: updates,
    });

    return dbSkill as SkillRenewal;
  }
);
