import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateTargetRequest, Target } from "./types";

export const create = api(
  { auth: true, expose: true, method: "POST", path: "/targets" },
  async (req: CreateTargetRequest): Promise<Target> => {
    const auth = getAuthData()!;

    const target = await db.rawQueryRow<Target>(
      `INSERT INTO targets (
        period_start, period_end, metric, target_count, actual_count, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      req.period_start,
      req.period_end,
      req.metric,
      req.target_count,
      req.actual_count || 0,
      req.notes,
      req.status || "active"
    );

    if (!target) {
      throw new Error("Failed to create target");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_target",
      entity_type: "target",
      entity_id: target.id.toString(),
      details: req,
    });

    return target;
  }
);
