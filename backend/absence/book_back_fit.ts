import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { Absence } from "./types";
import { recalcTriggersSafely, ukTodayIso } from "../lib/sickness";

interface BookBackFitRequest {
  absence_id: number;
  /** Optional — defaults to today (UK). The day the FF returned to work. */
  returned_on?: string; // YYYY-MM-DD
}

// ──────────────────────────────────────────────────────────────────────────────
// bookBackFit
//
// Closes out an open sickness. The original end_date is only the WC's
// expectation, so this sets end_date to the day before the FF actually
// returned — shorter or longer than expected — so Bradford totals reflect
// the real absence. Closes all of the person's open sickness rows.
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

    if (existing.returned_to_work_at) {
      throw APIError.failedPrecondition("This sickness has already been booked back fit");
    }

    // The day they came back (UK date). The sickness ran until the day
    // before — which may be later than the originally expected end date
    // (they didn't come back when expected) or earlier (came back early).
    const returnedIso = req.returned_on ?? ukTodayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(returnedIso)) {
      throw APIError.invalidArgument("returned_on must be YYYY-MM-DD");
    }
    const dayBeforeIso = new Date(Date.parse(returnedIso + "T00:00:00Z") - 86_400_000)
      .toISOString()
      .slice(0, 10);

    // Close every open sickness for this person, not just this row — a
    // duplicate booking would otherwise leave them showing as sick.
    // GREATEST keeps end_date >= start_date for same-day returns.
    const closedRows: Absence[] = [];
    for await (const row of db.query<Absence>`
      UPDATE absences
         SET returned_to_work_at = ${returnedIso}::date,
             end_date = GREATEST(start_date, ${dayBeforeIso}::date),
             updated_at = NOW()
       WHERE firefighter_id = ${existing.firefighter_id}
         AND type = 'sickness'
         AND status = 'approved'
         AND returned_to_work_at IS NULL
         AND start_date <= ${returnedIso}::date
       RETURNING *
    `) {
      closedRows.push(row);
    }

    const updated = closedRows.find((r) => r.id === existing.id) ?? closedRows[0];
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
        returned_on: returnedIso,
        closed_absence_ids: closedRows.map((r) => r.id),
      },
    });

    await recalcTriggersSafely(updated.firefighter_id);
    return updated;
  }
);
