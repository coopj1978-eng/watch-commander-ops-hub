import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateAbsenceRequest, Absence } from "./types";

export const create = api<CreateAbsenceRequest, Absence>(
  { auth: true, expose: true, method: "POST", path: "/absences" },
  async (req) => {
    const auth = getAuthData()!;
    const absence = await db.queryRow<Absence>`
      INSERT INTO absences (firefighter_id, type, start_date, end_date, reason, evidence_urls)
      VALUES (${req.user_id}, ${req.type}, ${req.start_date}, ${req.end_date}, ${req.reason}, ${req.evidence_urls})
      RETURNING *
    `;

    if (!absence) {
      throw new Error("Failed to create absence");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_absence",
      entity_type: "absence",
      entity_id: absence.id.toString(),
      details: { start_date: req.start_date, end_date: req.end_date, type: req.type },
    });

    return absence;
  }
);
