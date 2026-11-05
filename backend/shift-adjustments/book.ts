import { APIError } from "encore.dev/api";
import db from "../db";
import { insertAdjustmentEvents } from "./events";

// Puts an approved request on the calendar and crewing board (it also feeds
// the riding count). Flexi and Head for Head only get here once approved.

export async function bookAdjustment(b: {
  type: "flexi" | "h4h" | "flexi_payback";
  userId: string;
  date: string;
  dayNight: "Day" | "Night";
  coveringUserId?: string | null;
  coveringName?: string | null;
  coveringWatch?: string | null;
  notes?: string;
  createdBy: string;
}): Promise<number> {
  const owner = await db.rawQueryRow<{ name: string; watch_unit: string | null }>(
    `SELECT u.name, COALESCE(u.watch_unit, p.watch) AS watch_unit
     FROM users u LEFT JOIN firefighter_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    b.userId
  );
  if (!owner?.watch_unit) throw APIError.failedPrecondition("That person has no watch set, so it can't be booked.");

  const day = new Date(`${b.date}T00:00:00.000Z`);
  const adjustment = await db.queryRow<{
    id: number; user_id: string; type: string; start_date: Date; end_date: Date;
    covering_user_id: string | null; covering_name: string | null; covering_watch: string | null;
    shift_day_night: string | null; toil_hours: number | null; created_by_user_id: string;
  }>`
    INSERT INTO shift_adjustments (
      user_id, type, start_date, end_date, covering_user_id, covering_name,
      covering_watch, shift_day_night, watch_unit, notes, created_by_user_id
    ) VALUES (
      ${b.userId}, ${b.type}, ${day}, ${day}, ${b.coveringUserId || null}, ${b.coveringName || null},
      ${b.coveringWatch || null}, ${b.dayNight}, ${owner.watch_unit}, ${b.notes || null}, ${b.createdBy}
    )
    RETURNING id, user_id, type, start_date, end_date, covering_user_id, covering_name,
              covering_watch, shift_day_night, toil_hours, created_by_user_id
  `;
  if (!adjustment) throw APIError.internal("Couldn't save the booking.");

  await insertAdjustmentEvents(adjustment, { name: owner.name, watch_unit: owner.watch_unit });

  if (b.type === "h4h" && b.coveringUserId) await updateH4HLedger(adjustment.id, b.userId, owner.name, b.coveringUserId, b.date, b.createdBy);
  return adjustment.id;
}

/** The person covering is owed a shift, unless this swap is paying one back. */
async function updateH4HLedger(adjustmentId: number, offUserId: string, offName: string, coverId: string, date: string, by: string) {
  const cover = await db.queryRow<{ name: string }>`SELECT name FROM users WHERE id = ${coverId}`;
  if (!cover) return;

  const owed = await db.queryRow<{ id: number }>`
    SELECT id FROM h4h_ledger
    WHERE creditor_user_id = ${offUserId} AND debtor_user_id = ${coverId} AND status = 'pending'
    LIMIT 1
  `;
  if (owed) {
    await db.exec`
      UPDATE h4h_ledger SET
        status = 'settled', settled_at = NOW(), settled_by_user_id = ${by}, settled_via = 'auto',
        payback_shift_adjustment_id = ${adjustmentId}, updated_at = NOW()
      WHERE id = ${owed.id}
    `;
    return;
  }
  await db.exec`
    INSERT INTO h4h_ledger (creditor_user_id, creditor_name, debtor_user_id, debtor_name, shift_date, shift_adjustment_id)
    VALUES (${coverId}, ${cover.name}, ${offUserId}, ${offName}, ${date}, ${adjustmentId})
  `;
}
