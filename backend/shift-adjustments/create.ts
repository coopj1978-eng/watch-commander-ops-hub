import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { createNotification } from "../notification/helpers";
import type { ShiftAdjustment, ShiftAdjustmentType } from "./types";
import { insertAdjustmentEvents, spentReasonFor } from "./events";

export interface CreateShiftAdjustmentRequest {
  type: ShiftAdjustmentType;
  start_date: Date;
  end_date: Date;
  covering_user_id?: string;
  covering_name?: string;
  covering_watch?: string;        // for flexi_payback / orange_day
  shift_day_night?: "Day" | "Night"; // for flexi_payback / orange_day
  toil_hours?: number;            // for toil: how many hours being used (min 4)
  notes?: string;
  for_user_id?: string;           // WC/CC can log on behalf of another user
}

export const create = api<CreateShiftAdjustmentRequest, ShiftAdjustment>(
  { auth: true, expose: true, method: "POST", path: "/shift-adjustments" },
  async (req) => {
    const auth = getAuthData()!;

    // WC/CC can log on behalf of another user
    let targetUserId = auth.userID;
    if (req.for_user_id) {
      const callerRole = await db.queryRow<{ role: string }>`
        SELECT role FROM users WHERE id = ${auth.userID}
      `;
      if (!callerRole || !["WC", "CC"].includes(callerRole.role)) {
        throw APIError.permissionDenied("Only WC/CC can log shift adjustments for other users.");
      }
      targetUserId = req.for_user_id;
    }

    const userInfo = await db.queryRow<{ name: string; watch_unit: string | null }>`
      SELECT name, watch_unit FROM users WHERE id = ${targetUserId}
    `;

    if (!userInfo?.watch_unit) {
      throw APIError.failedPrecondition("The user must have a watch unit assigned before logging a shift adjustment.");
    }

    if (req.type === "h4h" && !req.covering_user_id && !req.covering_name) {
      throw APIError.invalidArgument("Head for Head requires a covering person.");
    }

    if (req.type === "toil") {
      if (!req.toil_hours || req.toil_hours < 4) {
        throw APIError.invalidArgument("TOIL requires a minimum of 4 hours.");
      }
      if (!req.covering_user_id && !req.covering_name) {
        throw APIError.invalidArgument("TOIL requires a covering person.");
      }
      // Check TOIL balance — earned hours carry over until used, so this
      // covers every year.
      const balanceRow = await db.rawQueryRow<{ balance: string }>(
        `SELECT COALESCE(SUM(CASE WHEN type = 'earned' AND status = 'approved' THEN hours ELSE 0 END) -
                SUM(CASE WHEN type = 'spent' THEN hours ELSE 0 END), 0) as balance
         FROM toil_ledger WHERE user_id = $1`,
        targetUserId
      );
      const available = Number(balanceRow?.balance ?? 0);
      if (available < req.toil_hours) {
        throw APIError.failedPrecondition(
          `Insufficient TOIL balance. Available: ${available}hrs, requested: ${req.toil_hours}hrs.`
        );
      }
    }

    if (new Date(req.end_date) < new Date(req.start_date)) {
      throw APIError.invalidArgument("End date must be on or after start date.");
    }

    let adjustment: ShiftAdjustment | null = null;
    try {
      adjustment = await db.queryRow<ShiftAdjustment>`
        INSERT INTO shift_adjustments (
          user_id, type, start_date, end_date,
          covering_user_id, covering_name,
          covering_watch, shift_day_night,
          toil_hours,
          watch_unit, notes, created_by_user_id
        ) VALUES (
          ${targetUserId},
          ${req.type},
          ${new Date(req.start_date as unknown as string)},
          ${new Date(req.end_date as unknown as string)},
          ${req.covering_user_id || null},
          ${req.covering_name || null},
          ${req.covering_watch || null},
          ${req.shift_day_night || null},
          ${req.toil_hours || null},
          ${userInfo.watch_unit},
          ${req.notes || null},
          ${auth.userID}
        )
        RETURNING *
      `;
    } catch (err: any) {
      console.error("shift_adjustments INSERT failed:", err);
      throw APIError.internal(`Failed to save shift adjustment: ${err?.message ?? String(err)}`);
    }

    if (!adjustment) throw APIError.internal("Failed to create shift adjustment.");

    // ── Create calendar events ────────────────────────────────────────────────
    // Every event is linked by shift_adjustment_id so edits/deletes can find
    // them; all-day anchors are noon UTC (see events.ts).
    try {
      await insertAdjustmentEvents(adjustment, {
        name: userInfo.name,
        watch_unit: userInfo.watch_unit,
      });
    } catch (err) {
      console.error("Failed to create shift adjustment calendar events:", err);
    }

    // ── H4H Ledger ────────────────────────────────────────────────────────────
    // Only applies to H4H where the covering person is an in-system user
    if (req.type === "h4h" && req.covering_user_id) {
      try {
        const coveringUser = await db.queryRow<{ name: string }>`
          SELECT name FROM users WHERE id = ${req.covering_user_id}
        `;

        if (coveringUser) {
          // Check: does the covering person already owe the logged-in user a shift?
          // i.e. creditor = auth.userID (is owed), debtor = covering_user_id (owes us)
          // If yes → this H4H is the payback, auto-settle and don't create new debt.
          const existingDebt = await db.queryRow<{ id: number }>`
            SELECT id FROM h4h_ledger
            WHERE creditor_user_id = ${targetUserId}
              AND debtor_user_id   = ${req.covering_user_id}
              AND status = 'pending'
            LIMIT 1
          `;

          if (existingDebt) {
            // Auto-settle — payback confirmed
            await db.exec`
              UPDATE h4h_ledger SET
                status                      = 'settled',
                settled_at                  = NOW(),
                settled_by_user_id          = ${auth.userID},
                settled_via                 = 'auto',
                payback_shift_adjustment_id = ${adjustment.id},
                updated_at                  = NOW()
              WHERE id = ${existingDebt.id}
            `;
          } else {
            // No existing debt — create a new one:
            // covering person (creditor) is owed; target user (debtor) owes them
            await db.exec`
              INSERT INTO h4h_ledger (
                creditor_user_id, creditor_name,
                debtor_user_id,   debtor_name,
                shift_date, shift_adjustment_id
              ) VALUES (
                ${req.covering_user_id}, ${coveringUser.name},
                ${targetUserId},          ${userInfo.name},
                ${req.start_date},       ${adjustment.id}
              )
            `;
          }
        }
      } catch (err) {
        console.error("Failed to update H4H ledger:", err);
      }
    }

    // ── TOIL Ledger — deduct hours ──────────────────────────────────────────────
    // Manual two-row transaction: the shift_adjustment row is already
    // committed at this point. If the spent ledger INSERT fails for any
    // reason, we MUST clean up the adjustment too — otherwise Sam ends up
    // with a phantom shift_adjustment that never debited his balance,
    // which is exactly the broken state we've been chasing all evening.
    if (req.type === "toil" && req.toil_hours) {
      const fy = new Date(req.start_date).getMonth() >= 3
        ? new Date(req.start_date).getFullYear()
        : new Date(req.start_date).getFullYear() - 1;

      // toil_ledger.incident_date is a DATE column. We need a YYYY-MM-DD
      // string. Encore decodes req.start_date to a JS Date object based
      // on the request type's declared `Date` field — String(date) returns
      // the locale string ("Sat Apr 25 2026 00:00:00 GMT+0100 (British
      // Summer Time)"), which after split("T")[0].slice(0,10) becomes
      // "Sat Apr 25" — total nonsense for a DATE column. Use the ISO
      // formatter to guarantee YYYY-MM-DD regardless of input shape.
      const incidentDateObj =
        req.start_date instanceof Date
          ? req.start_date
          : new Date(req.start_date as unknown as string);
      const dateOnly = incidentDateObj.toISOString().slice(0, 10);

      // Plain-ASCII reason; control chars stripped (rust-postgres rejects them).
      const spentReason = spentReasonFor(req.covering_name);

      try {
        // db.rawExec is the correct verb for INSERT without RETURNING
        // (rawQuery is lazy — never runs the statement).
        await db.rawExec(
          `INSERT INTO toil_ledger (user_id, type, hours, status, reason, shift_adjustment_id, incident_date, financial_year, watch_unit, created_by)
           VALUES ($1, 'spent', $2, 'approved', $3, $4, $5::date, $6, $7, $8)`,
          targetUserId,
          req.toil_hours,
          spentReason,
          adjustment.id,
          dateOnly,
          fy,
          userInfo.watch_unit,
          auth.userID
        );
      } catch (err) {
        console.error("toil_ledger spent INSERT failed — rolling back shift_adjustment", { adjustmentId: adjustment.id, err });
        try {
          // Events first — their FK is ON DELETE SET NULL, so deleting the
          // adjustment alone would leave orphan "TOIL off" events behind.
          await db.exec`DELETE FROM calendar_events WHERE shift_adjustment_id = ${adjustment.id}`;
          await db.exec`DELETE FROM shift_adjustments WHERE id = ${adjustment.id}`;
        } catch (rollbackErr) {
          console.error("Rollback of orphan shift_adjustment also failed:", rollbackErr);
        }
        throw APIError.unavailable(
          `Couldn't debit TOIL hours: ${err instanceof Error ? err.message : "DB error"}. The adjustment was rolled back so you can try again.`
        );
      }
    }

    // Notify WCs — own watch for outbound/orange, covered watch for flexi_payback
    try {
      const isFlexiPayback = req.type === "flexi_payback";
      const notifyWatch = isFlexiPayback ? (req.covering_watch ?? userInfo.watch_unit) : userInfo.watch_unit;

      const wcUsers = db.query<{ id: string }>`
        SELECT id FROM users
        WHERE role = 'WC' AND left_at IS NULL AND watch_unit = ${notifyWatch}
          AND id != ${auth.userID}
      `;

      const typeLabel =
        req.type === "flexi"         ? "Flexi Day"     :
        req.type === "training"      ? "Training"      :
        req.type === "h4h"           ? "Head for Head" :
        req.type === "toil"          ? "TOIL"          :
        req.type === "flexi_payback" ? "Flexi Payback" : "Orange Day";

      const startStr = new Date(req.start_date).toLocaleDateString("en-GB");
      const endStr   = new Date(req.end_date).toLocaleDateString("en-GB");
      // For Night-shift adjustments the dates straddle two calendar days;
      // collapse the displayed range to the start date so the notification
      // reads cleanly ("25/04/2026 · Night Shift" rather than
      // "25/04/2026 – 26/04/2026").
      const dateRange =
        req.shift_day_night === "Night" || startStr === endStr
          ? startStr
          : `${startStr} – ${endStr}`;
      const shiftLabel = req.shift_day_night ? ` · ${req.shift_day_night} Shift` : "";

      // Cover person's watch — useful context in the notification so the
      // recipient knows where the cover is coming from. Only resolved if
      // the cover is an in-system user.
      let coveringWatch: string | null = null;
      if (
        (req.type === "h4h" || req.type === "toil") &&
        req.covering_user_id
      ) {
        const coverRow = await db.queryRow<{ watch_unit: string | null }>`
          SELECT watch_unit FROM users WHERE id = ${req.covering_user_id}
        `;
        coveringWatch = coverRow?.watch_unit ?? null;
      }
      const coverLabel = req.covering_name
        ? coveringWatch
          ? `${req.covering_name} (${coveringWatch} Watch)`
          : req.covering_name
        : "an unknown cover";

      // Notification reads:
      //   "Sam Degg (White Watch) has logged a TOIL for 25/04/2026 · Night
      //    Shift. 16hrs TOIL used. Covered by Daniel Hazlett (Amber Watch)."
      let message = `${userInfo.name} (${userInfo.watch_unit} Watch) has logged a ${typeLabel} for ${dateRange}${shiftLabel}.`;
      if (req.type === "h4h") {
        message += ` Covered by ${coverLabel}.`;
      } else if (req.type === "toil") {
        message += ` ${req.toil_hours}hrs TOIL used. Covered by ${coverLabel}.`;
      } else if (isFlexiPayback) {
        message += ` They will cover ${notifyWatch} Watch.`;
      }

      for await (const wc of wcUsers) {
        await createNotification({
          user_id: wc.id,
          type: "general",
          title: `📅 ${typeLabel} Logged`,
          message,
          entity_type: "shift_adjustment",
          entity_id: adjustment.id.toString(),
          link: "/handover",
        });
      }
    } catch (err) {
      console.error("Failed to send shift adjustment notifications:", err);
    }

    return adjustment;
  }
);
