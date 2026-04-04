import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { createNotification } from "../notification/helpers";
import type { Absence } from "./types";

export interface SelfReportRequest {
  start_date: Date;
  end_date: Date;
  reason?: string;
  sick_line_document?: string; // base64 encoded image
}

export const selfReport = api<SelfReportRequest, Absence>(
  { auth: true, expose: true, method: "POST", path: "/absences/self-report" },
  async (req) => {
    const auth = getAuthData()!;

    // Any role can self-report sickness for themselves
    const absence = await db.queryRow<Absence>`
      INSERT INTO absences (
        firefighter_id, type, start_date, end_date, reason,
        sick_line_document, status, created_by_user_id
      )
      VALUES (
        ${auth.userID},
        'sickness',
        ${req.start_date},
        ${req.end_date},
        ${req.reason || "Self-reported sickness"},
        ${req.sick_line_document || null},
        'approved',
        ${auth.userID}
      )
      RETURNING *
    `;

    if (!absence) throw APIError.internal("Failed to create absence record");

    // Notify all WCs on the same watch
    try {
      const person = await db.queryRow<{ name: string; watch_unit: string | null }>`
        SELECT name, watch_unit FROM users WHERE id = ${auth.userID}
      `;

      if (person?.watch_unit) {
        const wcUsers = db.query<{ id: string }>`
          SELECT id FROM users
          WHERE role = 'WC'
            AND left_at IS NULL
            AND watch_unit = ${person.watch_unit}
            AND id != ${auth.userID}
        `;

        for await (const wc of wcUsers) {
          await createNotification({
            user_id: wc.id,
            type: "sick_booking",
            title: "🤒 Crew Member Reported Sick",
            message: `${person.name} has self-reported sick from ${new Date(req.start_date).toLocaleDateString("en-GB")}. ${req.sick_line_document ? "Sick line uploaded." : "No sick line attached yet."}`,
            entity_type: "absence",
            entity_id: absence.id.toString(),
            link: `/people`,
          });
        }

        // Also notify CCs on the same watch
        const ccUsers = db.query<{ id: string }>`
          SELECT id FROM users
          WHERE role = 'CC'
            AND left_at IS NULL
            AND watch_unit = ${person.watch_unit}
            AND id != ${auth.userID}
        `;

        for await (const cc of ccUsers) {
          await createNotification({
            user_id: cc.id,
            type: "sick_booking",
            title: "🤒 Crew Member Reported Sick",
            message: `${person.name} has self-reported sick from ${new Date(req.start_date).toLocaleDateString("en-GB")}.`,
            entity_type: "absence",
            entity_id: absence.id.toString(),
            link: `/people`,
          });
        }
      }
    } catch (err) {
      console.error("Failed to send sick notifications:", err);
    }

    return absence;
  }
);

export interface UpdateAbsenceDatesRequest {
  id: number;
  start_date?: Date;
  end_date?: Date;
  sick_line_document?: string;
}

// FF can update dates/sick line on their own absence. WC can update anything.
export const updateAbsence = api<UpdateAbsenceDatesRequest, Absence>(
  { auth: true, expose: true, method: "PATCH", path: "/absences/:id/update" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<{ id: number; firefighter_id: string }>`
      SELECT id, firefighter_id FROM absences WHERE id = ${req.id}
    `;

    if (!existing) throw APIError.notFound("Absence record not found");

    // FF can only update their own absence. WC/CC can update any.
    const isOwn = existing.firefighter_id === auth.userID;
    const isManager = auth.role === "WC" || auth.role === "CC";

    if (!isOwn && !isManager) {
      throw APIError.permissionDenied("You can only update your own absence records");
    }

    const updated = await db.queryRow<Absence>`
      UPDATE absences
      SET start_date          = COALESCE(${req.start_date ?? null}, start_date),
          end_date            = COALESCE(${req.end_date ?? null}, end_date),
          sick_line_document  = COALESCE(${req.sick_line_document ?? null}, sick_line_document),
          updated_at          = NOW()
      WHERE id = ${req.id}
      RETURNING *
    `;

    if (!updated) throw APIError.internal("Failed to update absence");
    return updated;
  }
);
