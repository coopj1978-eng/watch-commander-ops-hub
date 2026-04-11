import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

interface DeleteShiftAdjustmentRequest {
  id: number;
}

export const deleteAdjustment = api<DeleteShiftAdjustmentRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/shift-adjustments/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<{
      user_id: string;
      watch_unit: string;
      type: string;
      start_date: Date;
      end_date: Date;
      covering_user_id: string | null;
    }>`
      SELECT user_id, watch_unit, type, start_date, end_date, covering_user_id
      FROM shift_adjustments WHERE id = ${req.id}
    `;

    if (!existing) throw APIError.notFound("Shift adjustment not found.");

    // Only the owner or a WC/CC on the same watch can delete
    const isOwn = existing.user_id === auth.userID;
    const isManager = auth.role === "WC" || auth.role === "CC";

    if (!isOwn && !isManager) {
      throw APIError.permissionDenied("You can only delete your own shift adjustments.");
    }

    // ── Clean up TOIL ledger — refund spent hours ──────────────────────────────
    if (existing.type === "toil") {
      await db.exec`
        DELETE FROM toil_ledger
        WHERE shift_adjustment_id = ${req.id} AND type = 'spent'
      `;
    }

    // ── Clean up H4H ledger ──────────────────────────────────────────────────
    if (existing.type === "h4h") {
      // Delete any pending ledger entry linked to this adjustment
      // (If it was settled, leave the record but clear the FK — ON DELETE SET NULL handles that)
      await db.exec`
        DELETE FROM h4h_ledger
        WHERE shift_adjustment_id = ${req.id} AND status = 'pending'
      `;

      // If this adjustment was the payback for a settled entry, revert it to pending
      await db.exec`
        UPDATE h4h_ledger SET
          status = 'pending',
          settled_at = NULL,
          settled_by_user_id = NULL,
          settled_via = NULL,
          payback_shift_adjustment_id = NULL,
          updated_at = NOW()
        WHERE payback_shift_adjustment_id = ${req.id} AND status = 'settled'
      `;
    }

    // ── Clean up calendar events created by this adjustment ───────────────────
    // Calendar events are linked by: user_id + all_day + date overlap
    const startStr = typeof existing.start_date === "string"
      ? existing.start_date
      : (existing.start_date as Date).toISOString().split("T")[0];
    const endStr = typeof existing.end_date === "string"
      ? existing.end_date
      : (existing.end_date as Date).toISOString().split("T")[0];

    const startMidnight = `${startStr}T00:00:00.000Z`;
    const endEod = `${endStr}T23:59:59.999Z`;

    // Delete calendar events that match this adjustment's user + date range + all_day
    await db.exec`
      DELETE FROM calendar_events
      WHERE all_day = true
        AND start_time = ${startMidnight}::timestamptz
        AND end_time = ${endEod}::timestamptz
        AND (user_id = ${existing.user_id} OR created_by = ${existing.user_id})
    `;

    // For H4H / TOIL: also delete the covering person's calendar event
    if ((existing.type === "h4h" || existing.type === "toil") && existing.covering_user_id) {
      await db.exec`
        DELETE FROM calendar_events
        WHERE all_day = true
          AND start_time = ${startMidnight}::timestamptz
          AND end_time = ${endEod}::timestamptz
          AND user_id = ${existing.covering_user_id}
      `;
    }

    // ── Delete the shift adjustment ──────────────────────────────────────────
    await db.exec`DELETE FROM shift_adjustments WHERE id = ${req.id}`;

    await logActivity({
      user_id: auth.userID,
      action: "delete_shift_adjustment",
      entity_type: "shift_adjustment",
      entity_id: req.id.toString(),
      details: { type: existing.type, user_id: existing.user_id },
    });
  }
);
