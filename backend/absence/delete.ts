import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { recalcTriggersSafely } from "../lib/sickness";
import { absenceViewer, assertCanManageAbsencesOf } from "../lib/absenceAccess";

interface DeleteAbsenceRequest {
  id: number;
}

interface DeleteAbsenceResponse {
  success: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// deleteAbsence
//
// Permanent removal of an absence record. WC/CC on the person's watch
// only — used to undo a
// mistakenly-logged sickness (wrong person, wrong date, duplicate entry,
// etc.). The owner can NOT delete their own absences via this endpoint
// because it would let an FF erase a record after the WC has booked them
// off; corrections to your own absence go via the update endpoint.
//
// We capture the row before deleting so we can include enough detail in
// the activity log to restore it manually if needed.
// ──────────────────────────────────────────────────────────────────────────────
export const deleteAbsence = api<DeleteAbsenceRequest, DeleteAbsenceResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/absences/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<{
      id: number;
      firefighter_id: string;
      type: string;
      start_date: Date;
      end_date: Date;
      reason: string;
      status: string;
    }>`
      SELECT id, firefighter_id, type, start_date, end_date, reason, status
      FROM absences
      WHERE id = ${id}
    `;

    if (!existing) {
      throw APIError.notFound(`Absence ${id} not found`);
    }
    await assertCanManageAbsencesOf(await absenceViewer(), existing.firefighter_id);

    await db.exec`DELETE FROM absences WHERE id = ${id}`;

    await logActivity({
      user_id: auth.userID,
      action: "delete_absence",
      entity_type: "absence",
      entity_id: String(id),
      details: {
        firefighter_id: existing.firefighter_id,
        type: existing.type,
        start_date: existing.start_date,
        end_date: existing.end_date,
        reason: existing.reason,
        status: existing.status,
      },
    });

    await recalcTriggersSafely(existing.firefighter_id);
    return { success: true };
  }
);
