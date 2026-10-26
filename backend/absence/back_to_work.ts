import { api, APIError, Query } from "encore.dev/api";
import db from "../db";
import { logActivity } from "../logging/logger";
import { absenceViewer, assertCanManageAbsencesOf, assertCanViewAbsencesOf, visiblePersonIds } from "../lib/absenceAccess";

// Back to work interviews (see lib/backToWork.ts). Visible to the person and
// their own watch's WC/CC; recorded as done by a WC/CC on their watch.

export interface BackToWorkInterview {
  absence_id: number;
  user_id: string;
  name?: string;
  /** Start of their first shift back. */
  due_at: string;
  shift_label: string;
  done_at?: string;
  done_by_name?: string;
}

const iso = (d: Date | string | null | undefined) => (d == null ? undefined : d instanceof Date ? d.toISOString() : String(d));

function toInterview(r: any): BackToWorkInterview {
  return {
    absence_id: Number(r.absence_id), user_id: r.user_id, name: r.name ?? undefined,
    due_at: iso(r.due_at)!, shift_label: r.shift_label,
    done_at: iso(r.done_at), done_by_name: r.done_by_name ?? undefined,
  };
}

/**
 * With user_id: that person's interviews (newest first). Without: the
 * outstanding ones for the people a WC/CC manages — for the dashboard.
 */
export const listBackToWork = api<{ user_id?: Query<string> }, { interviews: BackToWorkInterview[] }>(
  { auth: true, expose: true, method: "GET", path: "/absences/back-to-work" },
  async ({ user_id }) => {
    const viewer = await absenceViewer();
    const select = `SELECT b.absence_id, b.user_id, b.due_at, b.shift_label, b.done_at, u.name, d.name AS done_by_name
                    FROM back_to_work_interviews b
                    JOIN users u ON u.id = b.user_id
                    LEFT JOIN users d ON d.id = b.done_by`;
    if (user_id) {
      await assertCanViewAbsencesOf(viewer, user_id);
      const rows = await db.rawQueryAll<any>(`${select} WHERE b.user_id = $1 ORDER BY b.due_at DESC`, user_id);
      return { interviews: rows.map(toInterview) };
    }
    if (!viewer.isManager) return { interviews: [] };
    const ids = [...(await visiblePersonIds(viewer))].filter((id) => id !== viewer.userID);
    if (ids.length === 0) return { interviews: [] };
    const rows = await db.rawQueryAll<any>(
      `${select} WHERE b.done_at IS NULL AND b.user_id = ANY($1::text[]) ORDER BY b.due_at`,
      ids
    );
    return { interviews: rows.map(toInterview) };
  }
);

export const backToWorkDone = api<{ absence_id: number }, BackToWorkInterview>(
  { auth: true, expose: true, method: "POST", path: "/absences/:absence_id/back-to-work-done" },
  async ({ absence_id }) => {
    const viewer = await absenceViewer();
    const row = await db.queryRow<{ user_id: string }>`
      SELECT user_id FROM back_to_work_interviews WHERE absence_id = ${absence_id}
    `;
    if (!row) throw APIError.notFound("No back to work interview for that sickness");
    // A WC/CC on their watch — not the person themself.
    await assertCanManageAbsencesOf(viewer, row.user_id);
    await db.exec`
      UPDATE back_to_work_interviews SET done_at = NOW(), done_by = ${viewer.userID}
      WHERE absence_id = ${absence_id} AND done_at IS NULL
    `;
    await logActivity({
      user_id: viewer.userID,
      action: "back_to_work_interview_done",
      entity_type: "absence",
      entity_id: String(absence_id),
      details: { firefighter_id: row.user_id },
    });
    const updated = await db.rawQueryRow<any>(
      `SELECT b.absence_id, b.user_id, b.due_at, b.shift_label, b.done_at, u.name, d.name AS done_by_name
       FROM back_to_work_interviews b JOIN users u ON u.id = b.user_id LEFT JOIN users d ON d.id = b.done_by
       WHERE b.absence_id = $1`,
      absence_id
    );
    return toInterview(updated);
  }
);
