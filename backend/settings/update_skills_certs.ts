import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { UpdateSkillsCertsRequest, SystemSettings } from "./types";
import { requirePermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";

export const updateSkillsCerts = api<UpdateSkillsCertsRequest, SystemSettings>(
  { auth: true, expose: true, method: "PATCH", path: "/settings/skills-certs" },
  async (req) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.MANAGE_SYSTEM_SETTINGS);

    const current = await db.rawQueryRow<SystemSettings>(
      `SELECT * FROM system_settings ORDER BY id DESC LIMIT 1`
    );

    if (!current) {
      throw new Error("System settings not found");
    }

    const updated = await db.rawQueryRow<SystemSettings>(
      `UPDATE system_settings 
       SET skills_dictionary = $1,
           certifications_dictionary = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      req.skills_dictionary ?? current.skills_dictionary,
      req.certifications_dictionary ?? current.certifications_dictionary,
      current.id
    );

    if (!updated) {
      throw new Error("Failed to update settings");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_skills_certs",
      entity_type: "settings",
      entity_id: updated.id.toString(),
      details: req,
    });

    return updated;
  }
);
