import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { notifyLineManagers } from "../lib/absenceAccess";
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
// returned — shorter or longer than expected — so trigger totals reflect
// the real absence. Closes all of the person's open sickness rows.
//
// Any WC/CC — whoever takes the call when they ring back in. The person's
// own watch WC/CC are notified. Nobody books themself back.
// ──────────────────────────────────────────────────────────────────────────────
export const bookBackFit = api<BookBackFitRequest, Absence>(
  { auth: true, expose: true, method: "POST", path: "/absences/:absence_id/book-back-fit" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<Absence>`
      SELECT * FROM absences WHERE id = ${req.absence_id}
    `;
    if (!existing) {
      throw APIError.notFound(`Absence ${req.absence_id} not found`);
    }
    if (auth.role !== "WC" && auth.role !== "CC") {
      throw APIError.permissionDenied("Only a Watch Commander or Crew Commander can book someone back fit.");
    }
    if (existing.firefighter_id === auth.userID) {
      throw APIError.permissionDenied("Another WC/CC needs to book you back fit.");
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

    const names = await db.queryRow<{ person: string; actor: string }>`
      SELECT (SELECT name FROM users WHERE id = ${updated.firefighter_id}) AS person,
             (SELECT name FROM users WHERE id = ${auth.userID}) AS actor
    `;
    const backOn = new Date(returnedIso + "T12:00:00Z").toLocaleDateString("en-GB");
    await notifyLineManagers(updated.firefighter_id, auth.userID, {
      title: "Booked back fit",
      message: `${names?.person ?? "A member of your watch"} has been booked back fit for duty from ${backOn}. Booked by ${names?.actor ?? "a WC/CC"}.`,
      absenceId: updated.id,
    });

    await recalcTriggersSafely(updated.firefighter_id);
    return updated;
  }
);
