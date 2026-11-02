import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { hasPermission, Permission } from "../auth/rbac";

// A person's record history (John, Nov 2026): changes made to their profile
// and skills, by whom and when, newest first — for the WC/CC. It replaces
// the old Activity Log tab, which listed the person's own sign-ins.

export interface ProfileHistoryEntry {
  id: number;
  at: string;
  /** Who made the change (null for the system). */
  by: string | null;
  action: string;
  details: Record<string, unknown>;
}

// GET /profiles/:id/history
export const profileHistory = api(
  { auth: true, expose: true, method: "GET", path: "/profiles/:id/history" },
  async ({ id, limit }: { id: number; limit?: number }): Promise<{ entries: ProfileHistoryEntry[] }> => {
    const auth = getAuthData()!;
    if (!hasPermission(auth, Permission.EDIT_ALL_PROFILES) && !hasPermission(auth, Permission.EDIT_ASSIGNED_FIREFIGHTERS)) {
      throw APIError.permissionDenied("Only a WC or CC can see a record's history");
    }
    const profile = await db.queryRow<{ user_id: string }>`SELECT user_id FROM firefighter_profiles WHERE id = ${id}`;
    if (!profile) throw APIError.notFound("profile not found");

    // update_profile is logged against the profile id (the page used to log
    // a second copy against the user id — those are left out); adding the
    // person is logged against either.
    const rows = await db.rawQueryAll<{ id: number; timestamp: Date; action: string; details: unknown; name: string | null }>(
      `SELECT al.id, al.timestamp, al.action, al.details, u.name
       FROM activity_log al LEFT JOIN users u ON u.id = al.user_id
       WHERE (al.entity_type = 'profile' AND al.entity_id = $1 AND al.action IN ('update_profile', 'create_person', 'import_person'))
          OR (al.entity_type = 'profile' AND al.entity_id = $2 AND al.action IN ('create_person', 'import_person'))
          OR (al.entity_type = 'skill_renewal' AND al.details->>'profile_id' = $1)
       ORDER BY al.timestamp DESC
       LIMIT $3`,
      String(id), profile.user_id, Math.min(Math.max(Number(limit) || 100, 1), 300)
    );
    return {
      entries: rows.map((r) => ({
        id: Number(r.id),
        at: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
        by: r.name,
        action: r.action,
        details: (typeof r.details === "string" ? JSON.parse(r.details) : r.details) ?? {},
      })),
    };
  }
);
