import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import db from "../db";

// DELETE /activities/:id
export const remove = api<{ id: number }, { ok: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/activities/:id" },
  async (req) => {
    // Only WCs and CCs log targets (John, Nov 2026); the UI matches.
    requireRole(getAuthData()!, "WC", "CC");
    const result = await db.rawQueryRow<{ id: number }>(
      `DELETE FROM activity_records WHERE id = $1 RETURNING id`,
      req.id
    );
    if (!result) throw APIError.notFound("activity record not found");
    return { ok: true };
  }
);
