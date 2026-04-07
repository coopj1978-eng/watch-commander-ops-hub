import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";
import type { UpdateFeatureFlagsRequest, SystemSettings } from "./types";

export const updateFeatureFlags = api<UpdateFeatureFlagsRequest, SystemSettings>(
  { auth: true, expose: true, method: "PUT", path: "/settings/feature-flags" },
  async (req) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.MANAGE_SYSTEM_SETTINGS);

    const result = await db.rawQueryRow<SystemSettings>(
      `UPDATE system_settings
       SET feature_flags = $1::jsonb, updated_at = NOW()
       WHERE id = (SELECT id FROM system_settings ORDER BY id DESC LIMIT 1)
       RETURNING *`,
      JSON.stringify(req.feature_flags)
    );

    if (!result) {
      throw new Error("Failed to update feature flags");
    }

    return result;
  }
);
