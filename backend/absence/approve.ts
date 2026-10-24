import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { Absence } from "./types";
import { recalcTriggersSafely } from "../lib/sickness";
import { absenceViewer, assertCanManageAbsencesOf } from "../lib/absenceAccess";

interface ApproveAbsenceRequest {
  id: number;
}

export const approve = api<ApproveAbsenceRequest, Absence>(
  { auth: true, expose: true, method: "POST", path: "/absences/:id/approve" },
  async ({ id }) => {
    const auth = getAuthData()!;
    const target = await db.queryRow<{ firefighter_id: string }>`
      SELECT firefighter_id FROM absences WHERE id = ${id}
    `;
    if (!target) {
      throw APIError.notFound("absence not found");
    }
    // The person's own watch WC/CC approves — nobody approves their own.
    await assertCanManageAbsencesOf(await absenceViewer(), target.firefighter_id);

    const absence = await db.queryRow<Absence>`
      UPDATE absences
      SET status = 'approved', approved_by = ${auth.userID}, approved_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!absence) {
      throw APIError.notFound("absence not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "approve_absence",
      entity_type: "absence",
      entity_id: id.toString(),
      details: { firefighter_id: absence.firefighter_id },
    });

    await recalcTriggersSafely(absence.firefighter_id);
    return absence;
  }
);
