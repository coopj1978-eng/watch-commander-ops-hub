import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import db from "../db";
import { logActivity } from "../logging/logger";

// DELETE /api/detachments/:id — take a detachment off the record (Nov 2026).
// One put on by mistake, or left behind by a deleted account, used to stay in
// the history and count on the fairness rota for good: taking someone off the
// crewing board's Detached box doesn't remove it.
export const remove = api<{ id: number }, { ok: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/api/detachments/:id" },
  async (req) => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");

    const row = await db.rawQueryRow<{ firefighter_name: string; home_watch: string; to_station: string; detachment_date: string }>(
      `DELETE FROM detachments WHERE id = $1
       RETURNING firefighter_name, home_watch, to_station, detachment_date::text`,
      req.id,
    );
    if (!row) throw APIError.notFound("Detachment not found");

    await logActivity({
      user_id: auth.userID,
      action: "remove_detachment",
      entity_type: "detachment",
      entity_id: String(req.id),
      details: row,
    });
    return { ok: true };
  },
);
