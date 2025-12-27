import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";
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
    requirePermission(auth, Permission.EDIT_ALL_PROFILES);

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
