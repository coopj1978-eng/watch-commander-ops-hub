import { api } from "encore.dev/api";
import { requireRole } from "../auth/rbac";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { SystemSettings, UpdateTriggerThresholdsRequest } from "./types";

export const updateTriggerThresholds = api<UpdateTriggerThresholdsRequest, SystemSettings>(
  { method: "PUT", path: "/settings/trigger-thresholds", expose: true, auth: true },
  async (req) => {
    const auth = getAuthData()!;
    requireRole(auth, "WC");

    const updates: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (req.trigger_stage1_episodes !== undefined) {
      updates.push(`trigger_stage1_episodes = $${paramIndex++}`);
      values.push(req.trigger_stage1_episodes);
    }
    if (req.trigger_stage1_days !== undefined) {
      updates.push(`trigger_stage1_days = $${paramIndex++}`);
      values.push(req.trigger_stage1_days);
    }
    if (req.trigger_stage2_episodes !== undefined) {
      updates.push(`trigger_stage2_episodes = $${paramIndex++}`);
      values.push(req.trigger_stage2_episodes);
    }
    if (req.trigger_stage2_days !== undefined) {
      updates.push(`trigger_stage2_days = $${paramIndex++}`);
      values.push(req.trigger_stage2_days);
    }
    if (req.trigger_stage3_episodes !== undefined) {
      updates.push(`trigger_stage3_episodes = $${paramIndex++}`);
      values.push(req.trigger_stage3_episodes);
    }
    if (req.trigger_stage3_days !== undefined) {
      updates.push(`trigger_stage3_days = $${paramIndex++}`);
      values.push(req.trigger_stage3_days);
    }

    if (updates.length === 0) {
      const settings = await db.rawQueryRow<SystemSettings>(
        `SELECT * FROM system_settings ORDER BY id DESC LIMIT 1`
      );
      if (!settings) throw new Error("Settings not found");
      return settings;
    }

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE system_settings
      SET ${updates.join(", ")}
      WHERE id = (SELECT id FROM system_settings ORDER BY id DESC LIMIT 1)
      RETURNING *
    `;

    const updated = await db.rawQueryRow<SystemSettings>(query, ...values);

    if (!updated) {
      throw new Error("Failed to update trigger thresholds");
    }

    return updated;
  }
);
