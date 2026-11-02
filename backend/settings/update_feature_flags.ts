import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { UpdateFeatureFlagsRequest, SystemSettings } from "./types";

export const updateFeatureFlags = api<UpdateFeatureFlagsRequest, SystemSettings>(
  { auth: true, expose: true, method: "PUT", path: "/settings/feature-flags" },
  async (req) => {
    const auth = getAuthData()!;
    // Switching a page on or off changes it for the whole station, every
    // watch — the admin's call, not any one WC's (John, Nov 2026).
    if (!auth.isAdmin) {
      throw APIError.permissionDenied("Only the admin can switch pages on or off.");
    }

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
