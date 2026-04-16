import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { AddAttendanceRequest, RemoveAttendanceRequest } from "./types";

interface SuccessResponse {
  success: boolean;
}

export const addAttendance = api<AddAttendanceRequest, SuccessResponse>(
  { auth: true, expose: true, method: "POST", path: "/training/:id/attendance" },
  async (req) => {
    getAuthData()!;

    if (!req.user_ids || req.user_ids.length === 0) {
      throw APIError.invalidArgument("user_ids is required and must not be empty");
    }

    // Verify training record exists
    const record = await db.rawQueryRow<{ id: number }>(
      `SELECT id FROM training_records WHERE id = $1`,
      req.id
    );

    if (!record) {
      throw APIError.notFound("training record not found");
    }

    // Upsert each attendee
    for (const userId of req.user_ids) {
      await db.rawExec(
        `INSERT INTO training_attendance (training_id, user_id, competencies_covered, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (training_id, user_id)
         DO UPDATE SET
           competencies_covered = COALESCE($3, training_attendance.competencies_covered),
           notes = COALESCE($4, training_attendance.notes)`,
        req.id,
        userId,
        req.competencies_covered ?? [],
        req.notes ?? null
      );
    }

    return { success: true };
  }
);

export const removeAttendance = api<RemoveAttendanceRequest, SuccessResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/training/:id/attendance/:userId" },
  async (req) => {
    getAuthData()!;

    await db.rawExec(
      `DELETE FROM training_attendance WHERE training_id = $1 AND user_id = $2`,
      req.id,
      req.userId
    );

    return { success: true };
  }
);
