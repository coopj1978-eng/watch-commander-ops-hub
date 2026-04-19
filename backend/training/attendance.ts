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

    const hasInternal = !!(req.user_ids && req.user_ids.length > 0);
    const hasExternal = !!(req.externals && req.externals.length > 0);
    if (!hasInternal && !hasExternal) {
      throw APIError.invalidArgument("at least one internal or external attendee is required");
    }

    // Verify training record exists
    const record = await db.rawQueryRow<{ id: number }>(
      `SELECT id FROM training_records WHERE id = $1`,
      req.id
    );

    if (!record) {
      throw APIError.notFound("training record not found");
    }

    // Upsert each internal attendee (uses UNIQUE(training_id, user_id) for idempotency)
    if (req.user_ids) {
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
    }

    // Insert external attendees. These have user_id = NULL and free-text name/rank/station.
    // The UNIQUE constraint treats multiple NULL user_ids as distinct, which is what we want
    // (different people can be added under the same training); however we still dedupe
    // by case-insensitive name within this call to guard against accidental double-clicks.
    if (req.externals) {
      const seen = new Set<string>();
      for (const ext of req.externals) {
        const name = ext.name?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        await db.rawExec(
          `INSERT INTO training_attendance (
             training_id, user_id, external_name, external_rank, external_station,
             competencies_covered, notes
           )
           VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
          req.id,
          name,
          ext.rank?.trim() || null,
          ext.station?.trim() || null,
          req.competencies_covered ?? [],
          req.notes ?? null
        );
      }
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
