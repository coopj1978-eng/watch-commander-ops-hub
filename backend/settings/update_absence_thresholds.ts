import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { UpdateAbsenceThresholdsRequest, SystemSettings } from "./types";
import { requirePermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";

export const updateAbsenceThresholds = api<UpdateAbsenceThresholdsRequest, SystemSettings>(
  { auth: true, expose: true, method: "PATCH", path: "/settings/absence-thresholds" },
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
       SET absence_threshold_days = $1,
           absence_threshold_period_months = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      req.absence_threshold_days ?? current.absence_threshold_days,
      req.absence_threshold_period_months ?? current.absence_threshold_period_months,
      current.id
    );

    if (!updated) {
      throw new Error("Failed to update settings");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_absence_thresholds",
      entity_type: "settings",
      entity_id: updated.id.toString(),
      details: req,
    });

    return updated;
  }
);
