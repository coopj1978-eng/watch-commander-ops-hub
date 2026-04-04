import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

interface RefreshResponse {
  generated: number;
}

/**
 * Refreshes notifications for the current user.
 * Generates cert_expiry, task_overdue, and crewing_gap notifications.
 * Deduplicates: will not create a duplicate notification for the same entity
 * if one already exists that is unread.
 */
export const refresh = api<void, RefreshResponse>(
  { auth: true, expose: true, method: "POST", path: "/notifications/refresh" },
  async (): Promise<RefreshResponse> => {
    const auth = getAuthData()!;
    const userId = auth.userID;
    let generated = 0;

    // Helper: insert a notification only if no unread one exists for same entity_type+entity_id+type
    const maybeInsert = async (params: {
      type: string;
      title: string;
      message: string;
      entity_type: string;
      entity_id: string;
      link?: string;
    }) => {
      const existing = await db.rawQueryRow<{ id: number }>(
        `SELECT id FROM notifications
         WHERE user_id = $1
           AND type = $2
           AND entity_type = $3
           AND entity_id = $4
           AND read = false
           AND created_at > NOW() - INTERVAL '7 days'`,
        userId, params.type, params.entity_type, params.entity_id
      );
      if (existing) return; // already have an unread one

      await db.rawExec(
        `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, link)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        userId, params.type, params.title, params.message,
        params.entity_type, params.entity_id, params.link ?? null
      );
      generated++;
    };

    // ── 1. Cert / skill expiry (expiring within 30 days or already expired) ──────
    const expiringSkills = await db.rawQuery<{
      id: number;
      skill_name: string;
      expiry_date: Date | string;
      user_name: string;
      user_id: string;
      watch: string;
    }>(
      `SELECT sr.id, sr.skill_name, sr.expiry_date, u.name AS user_name, u.id AS user_id, fp.watch
       FROM skill_renewals sr
       JOIN firefighter_profiles fp ON sr.profile_id = fp.id
       JOIN users u ON fp.user_id = u.id
       WHERE u.left_at IS NULL
         AND sr.expiry_date IS NOT NULL
         AND sr.expiry_date <= CURRENT_DATE + INTERVAL '30 days'`
    );

    // Only notify WC about their own watch's expiries
    const userRow = await db.rawQueryRow<{ watch_unit: string; role: string }>(
      `SELECT watch_unit, role FROM users WHERE id = $1`, userId
    );

    for await (const skill of expiringSkills) {
      // WC sees all expiries on their watch; individuals see their own
      if (userRow?.role === "WC" && skill.watch !== userRow.watch_unit) continue;
      if (userRow?.role !== "WC" && skill.user_id !== userId) continue;

      const expiry = new Date(skill.expiry_date);
      const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
      const isExpired = daysLeft < 0;

      await maybeInsert({
        type: "cert_expiry",
        title: isExpired
          ? `${skill.skill_name} expired`
          : `${skill.skill_name} expiring soon`,
        message: isExpired
          ? `${skill.user_name}'s ${skill.skill_name} certification expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""} ago.`
          : `${skill.user_name}'s ${skill.skill_name} certification expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`,
        entity_type: "skill_renewal",
        entity_id: String(skill.id),
        link: `/people`,
      });
    }

    // ── 2. Overdue tasks (assigned to this user's watch or directly to them) ─────
    const overdueTasks = await db.rawQuery<{
      id: number;
      title: string;
      due_at: Date | string;
      assigned_to_user_id: string | null;
      watch_unit: string | null;
    }>(
      `SELECT t.id, t.title, t.due_at, t.assigned_to_user_id, t.watch_unit
       FROM tasks t
       WHERE t.status != 'Done'
         AND t.due_at IS NOT NULL
         AND t.due_at < NOW()
         AND (
           t.watch_unit = $1
           OR t.assigned_to_user_id = $2
         )
       ORDER BY t.due_at ASC
       LIMIT 20`,
      userRow?.watch_unit ?? "", userId
    );

    for await (const task of overdueTasks) {
      const daysOverdue = Math.floor((Date.now() - new Date(task.due_at).getTime()) / 86400000);
      await maybeInsert({
        type: "task_overdue",
        title: `Task overdue: ${task.title}`,
        message: `"${task.title}" was due ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} ago.`,
        entity_type: "task",
        entity_id: String(task.id),
        link: `/tasks`,
      });
    }

    // ── 3. Crewing gaps today (WC only) ──────────────────────────────────────────
    if (userRow?.role === "WC") {
      const today = new Date().toISOString().split("T")[0];
      const crewingGaps = await db.rawQueryRow<{ gap_count: number }>(
        `SELECT COUNT(*) as gap_count
         FROM crewing_slots cs
         JOIN crewing_entries ce ON cs.crewing_entry_id = ce.id
         WHERE ce.date = $1
           AND ce.watch_unit = $2
           AND cs.is_required = true
           AND cs.assigned_user_id IS NULL`,
        today, userRow.watch_unit
      );

      if (crewingGaps && crewingGaps.gap_count > 0) {
        await maybeInsert({
          type: "crewing_gap",
          title: `${crewingGaps.gap_count} crewing slot${crewingGaps.gap_count !== 1 ? "s" : ""} unfilled`,
          message: `Today's crewing board has ${crewingGaps.gap_count} required slot${crewingGaps.gap_count !== 1 ? "s" : ""} that ${crewingGaps.gap_count !== 1 ? "are" : "is"} not yet filled.`,
          entity_type: "crewing",
          entity_id: today,
          link: `/handover`,
        });
      }
    }

    return { generated };
  }
);
