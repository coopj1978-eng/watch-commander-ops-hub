import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { UpdateBrandingRequest, SystemSettings } from "./types";
import { requirePermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";

export const updateBranding = api<UpdateBrandingRequest, SystemSettings>(
  { auth: true, expose: true, method: "PATCH", path: "/settings/branding" },
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
       SET branding_logo_url = $1,
           branding_primary_color = $2,
           branding_secondary_color = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      req.branding_logo_url ?? current.branding_logo_url,
      req.branding_primary_color ?? current.branding_primary_color,
      req.branding_secondary_color ?? current.branding_secondary_color,
      current.id
    );

    if (!updated) {
      throw new Error("Failed to update settings");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_branding",
      entity_type: "settings",
      entity_id: updated.id.toString(),
      details: req,
    });

    return updated;
  }
);
