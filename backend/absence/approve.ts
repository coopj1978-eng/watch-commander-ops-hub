import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { Absence } from "./types";

interface ApproveAbsenceRequest {
  id: number;
}

export const approve = api<ApproveAbsenceRequest, Absence>(
  { auth: true, expose: true, method: "POST", path: "/absences/:id/approve" },
  async ({ id }) => {
    const auth = getAuthData()!;
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

    return absence;
  }
);
