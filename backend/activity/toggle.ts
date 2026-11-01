import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import db from "../db";
import type { ActivityRecord } from "./types";

// PATCH /activities/:id/toggle
// Flips the completed flag on an activity record.
export const toggle = api<{ id: number }, ActivityRecord>(
  { auth: true, expose: true, method: "PATCH", path: "/activities/:id/toggle" },
  async (req) => {
    // Only WCs and CCs log targets (John, Nov 2026); the UI matches.
    requireRole(getAuthData()!, "WC", "CC");
    // Fetch current state first
    const current = await db.rawQueryRow<ActivityRecord>(
      `SELECT * FROM activity_records WHERE id = $1`,
      req.id
    );
    if (!current) throw APIError.notFound("activity record not found");

    const nowCompleted = !current.completed;

    const row = await db.rawQueryRow<ActivityRecord>(
      `UPDATE activity_records
       SET completed    = $1,
           completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           updated_at   = NOW()
       WHERE id = $2
       RETURNING *`,
      nowCompleted,
      req.id
    );

    if (!row) throw APIError.notFound("activity record not found");
    return row;
  }
);
