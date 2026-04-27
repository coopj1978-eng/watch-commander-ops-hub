import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { Absence } from "./types";

interface BookBackFitRequest {
  absence_id: number;
  /** Optional — defaults to today. The day the FF returned to work; the
   *  absence's end_date gets snapped to (returned_at - 1 day) so the
   *  total-days roll-up reflects when they were actually off. */
  returned_on?: string; // YYYY-MM-DD
}

// ──────────────────────────────────────────────────────────────────────────────
// bookBackFit
//
// Closes out an open sickness absence. The original end_date may have
// been just the WC's best guess; this endpoint:
//   • stamps `returned_to_work_at` so the absence stops counting as
//     "currently off" on the dashboard,
//   • adjusts end_date if returned_on is on or before the existing
//     end_date so the historical record reflects when the FF actually
//     returned (whichever is earlier — never extend the recorded
//     sickness beyond the original window unless the WC explicitly
//     does so via the edit-absence flow).
//
// WC/CC only — same authorisation level as logging the sickness.
// ──────────────────────────────────────────────────────────────────────────────
export const bookBackFit = api<BookBackFitRequest, Absence>(
  { auth: true, expose: true, method: "POST", path: "/absences/:absence_id/book-back-fit" },
  async (req) => {
    const auth = getAuthData()!;

    if (auth.role !== "WC" && auth.role !== "CC") {
      throw APIError.permissionDenied("Only WC or CC can book a firefighter back fit");
    }

    const existing = await db.queryRow<Absence>`
      SELECT * FROM absences WHERE id = ${req.absence_id}
    `;
    if (!existing) {
      throw APIError.notFound(`Absence ${req.absence_id} not found`);
    }
    if (existing.type !== "sickness") {
      throw APIError.invalidArgument("Only sickness absences can be booked back fit");
    }

    // Default returned-on = today (local). Stored as a real timestamp
    // so we keep the full audit trail of WHEN the WC actioned this, not
    // just the date.
    const returnedOnDate = req.returned_on
      ? new Date(req.returned_on + "T00:00:00.000Z")
      : new Date();

    // Effective end_date: the day before they came back, but never
    // beyond the original end_date (the WC can extend via the absence
    // edit flow, not via this action).
    const dayBeforeReturn = new Date(returnedOnDate.getTime() - 86_400_000);
    const dayBeforeReturnIso = dayBeforeReturn.toISOString().slice(0, 10);
    const originalEndIso =
      existing.end_date instanceof Date
        ? existing.end_date.toISOString().slice(0, 10)
        : String(existing.end_date).slice(0, 10);
    const newEndIso =
      dayBeforeReturnIso < originalEndIso ? dayBeforeReturnIso : originalEndIso;

    const updated = await db.queryRow<Absence>`
      UPDATE absences
         SET returned_to_work_at = ${returnedOnDate},
             end_date = ${newEndIso}::date,
             updated_at = NOW()
       WHERE id = ${req.absence_id}
       RETURNING *
    `;

    if (!updated) {
      throw APIError.internal("Failed to book back fit");
    }

    await logActivity({
      user_id: auth.userID,
      action: "book_back_fit",
      entity_type: "absence",
      entity_id: String(updated.id),
      details: {
        firefighter_id: updated.firefighter_id,
        returned_on: returnedOnDate.toISOString(),
        original_end_date: originalEndIso,
        new_end_date: newEndIso,
      },
    });

    return updated;
  }
);
