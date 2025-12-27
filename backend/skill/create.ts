import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";
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
    requirePermission(auth, Permission.EDIT_ALL_PROFILES);

    const dbSkill = await db.queryRow<DBSkillRenewal>`
      INSERT INTO skill_renewals (
        profile_id, skill_name, acquired_date, renewal_date, expiry_date, notes
      )
      VALUES (
        ${req.profile_id},
        ${req.skill_name},
        ${req.acquired_date ? new Date(req.acquired_date) : null},
        ${req.renewal_date ? new Date(req.renewal_date) : null},
        ${req.expiry_date ? new Date(req.expiry_date) : null},
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
