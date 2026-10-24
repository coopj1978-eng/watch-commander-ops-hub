import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { createNotification } from "../notification/helpers";
import type { Absence } from "./types";
import { assertNoOpenSickness, recalcTriggersSafely } from "../lib/sickness";
import { absenceViewer, canManageAbsencesOf } from "../lib/absenceAccess";

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
    await assertNoOpenSickness(auth.userID);

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

    await recalcTriggersSafely(absence.firefighter_id);
    return absence;
  }
);

export interface UpdateAbsenceDatesRequest {
  id: number;
  start_date?: Date;
  end_date?: Date;
  sick_line_document?: string;
}

// The person can attach a sick line to their own absence; only a WC/CC on
// their watch can change the dates.
export const updateAbsence = api<UpdateAbsenceDatesRequest, Absence>(
  { auth: true, expose: true, method: "PATCH", path: "/absences/:id/update" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<{
      id: number;
      firefighter_id: string;
      type: string;
      start_date: Date;
      sick_line_document: string | null;
    }>`
      SELECT id, firefighter_id, type, start_date, sick_line_document
      FROM absences
      WHERE id = ${req.id}
    `;

    if (!existing) throw APIError.notFound("Absence record not found");

    const isOwn = existing.firefighter_id === auth.userID;
    if (!(await canManageAbsencesOf(await absenceViewer(), existing.firefighter_id))) {
      if (!isOwn) {
        throw APIError.permissionDenied(
          "Only a Watch Commander or Crew Commander on this person's watch can change their absence records."
        );
      }
      if (req.start_date !== undefined || req.end_date !== undefined) {
        throw APIError.permissionDenied(
          "Only your Watch Commander or Crew Commander can change the dates. You can attach a sick line."
        );
      }
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

    // If a firefighter attached a sick line where there wasn't one before,
    // notify the Watch Commanders (+CCs) on their watch so they know to
    // check it. Only fires on the null → set transition; subsequent
    // replacements don't spam. We only send these for sickness absences —
    // non-sickness record types don't use the sick-line field.
    const sickLineJustUploaded =
      isOwn &&
      existing.type === "sickness" &&
      !existing.sick_line_document &&
      !!req.sick_line_document;

    if (sickLineJustUploaded) {
      try {
        const person = await db.queryRow<{ name: string; watch_unit: string | null }>`
          SELECT name, watch_unit FROM users WHERE id = ${auth.userID}
        `;

        if (person?.watch_unit) {
          const startDateStr = new Date(existing.start_date).toLocaleDateString("en-GB");

          const wcUsers = db.query<{ id: string }>`
            SELECT id FROM users
            WHERE role IN ('WC', 'CC')
              AND left_at IS NULL
              AND watch_unit = ${person.watch_unit}
              AND id != ${auth.userID}
          `;

          for await (const recipient of wcUsers) {
            await createNotification({
              user_id: recipient.id,
              type: "sick_booking",
              title: "📄 Sick Line Uploaded",
              message: `${person.name} has uploaded a sick line for their ${startDateStr} absence.`,
              entity_type: "absence",
              entity_id: updated.id.toString(),
              link: `/people`,
            });
          }
        }
      } catch (err) {
        // Notification failures shouldn't block the user's upload.
        console.error("Failed to send sick-line-uploaded notifications:", err);
      }
    }

    await recalcTriggersSafely(updated.firefighter_id);
    return updated;
  }
);
