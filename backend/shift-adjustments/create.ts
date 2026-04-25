import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { createNotification } from "../notification/helpers";
import type { ShiftAdjustment, ShiftAdjustmentType } from "./types";

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
      // Check TOIL balance
      const balanceRow = await db.rawQueryRow<{ balance: string }>(
        `SELECT COALESCE(SUM(CASE WHEN type = 'earned' AND status = 'approved' THEN hours ELSE 0 END) -
                SUM(CASE WHEN type = 'spent' THEN hours ELSE 0 END), 0) as balance
         FROM toil_ledger WHERE user_id = $1 AND financial_year = $2`,
        targetUserId,
        new Date(req.start_date).getMonth() >= 3
          ? new Date(req.start_date).getFullYear()
          : new Date(req.start_date).getFullYear() - 1
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
    try {
      const startMidnight = new Date(req.start_date);
      startMidnight.setUTCHours(0, 0, 0, 0);

      // For Night shifts, the calendar event must NOT spread across both
      // calendar dates the shift physically straddles (18:00 → 08:00 next
      // morning). The user enters start=25, end=26 because the shift ends
      // the next morning, but conceptually it's "the night of the 25th."
      // Collapse end_time to end-of-start-date in that case so the event
      // shows on one day only — like an all-day event for the start date.
      const endSource =
        req.shift_day_night === "Night"
          ? new Date(req.start_date)
          : new Date(req.end_date);
      const endEod = endSource;
      endEod.setUTCHours(23, 59, 59, 999);

      // Helpful suffix for calendar event titles + WC notifications.
      const shiftSuffix = req.shift_day_night
        ? ` · ${req.shift_day_night} Shift`
        : "";

      const isFlexiPayback = req.type === "flexi_payback";

      if (isFlexiPayback) {
        // Flexi Payback: person comes IN to cover another watch.
        const coveredWatch = req.covering_watch!;
        const shiftLabel   = req.shift_day_night ?? "Day";

        await db.exec`
          INSERT INTO calendar_events (
            title, event_type, calendar_visibility, start_time, end_time,
            all_day, user_id, is_watch_event, watch, created_by
          ) VALUES (
            ${`${userInfo.name} – Flexi Payback (${shiftLabel} Shift)`},
            'personal',
            'watch',
            ${startMidnight},
            ${endEod},
            true,
            ${targetUserId},
            true,
            ${coveredWatch},
            ${auth.userID}
          )
        `;
      } else if (req.type === "orange_day") {
        // Orange Day: person is working an extra shift (day or night)
        const shiftLabel = req.shift_day_night ?? "Day";

        // 1. Personal event
        await db.exec`
          INSERT INTO calendar_events (
            title, event_type, calendar_visibility, start_time, end_time,
            all_day, user_id, is_watch_event, watch, created_by
          ) VALUES (
            ${`Orange Day (${shiftLabel} Shift)`},
            'personal',
            'personal',
            ${startMidnight},
            ${endEod},
            true,
            ${targetUserId},
            false,
            ${userInfo.watch_unit},
            ${auth.userID}
          )
        `;

        // 2. Watch calendar event so WC can see it
        await db.exec`
          INSERT INTO calendar_events (
            title, event_type, calendar_visibility, start_time, end_time,
            all_day, user_id, is_watch_event, watch, created_by
          ) VALUES (
            ${`${userInfo.name} – Orange Day (${shiftLabel} Shift)`},
            'personal',
            'watch',
            ${startMidnight},
            ${endEod},
            true,
            ${targetUserId},
            true,
            ${userInfo.watch_unit},
            ${auth.userID}
          )
        `;
      } else {
        // Outbound: person is away from their own watch
        const typeLabel =
          req.type === "flexi"    ? "Flexi Day"    :
          req.type === "training" ? "Training"     :
          req.type === "toil"    ? `TOIL (${req.toil_hours}hrs)` : "Head for Head";

        const eventType = req.type === "training" ? "training" : "personal";

        // 1. Personal event for the absent person
        await db.exec`
          INSERT INTO calendar_events (
            title, event_type, calendar_visibility, start_time, end_time,
            all_day, user_id, is_watch_event, watch, created_by
          ) VALUES (
            ${req.type === "h4h"
                ? `H4H – Off${shiftSuffix} (covered by ${req.covering_name || "cover"})`
                : req.type === "toil"
                ? `TOIL – Off ${req.toil_hours}hrs${shiftSuffix} (covered by ${req.covering_name || "cover"})`
                : typeLabel},
            ${eventType},
            'personal',
            ${startMidnight},
            ${endEod},
            true,
            ${targetUserId},
            false,
            ${userInfo.watch_unit},
            ${auth.userID}
          )
        `;

        // 2. Watch calendar event (visible to whole watch)
        await db.exec`
          INSERT INTO calendar_events (
            title, event_type, calendar_visibility, start_time, end_time,
            all_day, user_id, is_watch_event, watch, created_by
          ) VALUES (
            ${req.type === "h4h"
                ? `${userInfo.name} – H4H${shiftSuffix} (covered by ${req.covering_name || "cover"})`
                : req.type === "toil"
                ? `${userInfo.name} – TOIL ${req.toil_hours}hrs${shiftSuffix} (covered by ${req.covering_name || "cover"})`
                : `${userInfo.name} – ${typeLabel}`},
            ${eventType},
            'watch',
            ${startMidnight},
            ${endEod},
            true,
            ${targetUserId},
            true,
            ${userInfo.watch_unit},
            ${auth.userID}
          )
        `;

        // 3. H4H / TOIL: personal event for the covering person (if in system)
        if ((req.type === "h4h" || req.type === "toil") && req.covering_user_id) {
          await db.exec`
            INSERT INTO calendar_events (
              title, event_type, calendar_visibility, start_time, end_time,
              all_day, user_id, is_watch_event, watch, created_by
            ) VALUES (
              ${req.type === "toil"
                ? `TOIL – Covering for ${userInfo.name} (${userInfo.watch_unit} Watch)${shiftSuffix} — ${req.toil_hours}hrs`
                : `H4H – Covering for ${userInfo.name} (${userInfo.watch_unit} Watch)${shiftSuffix}`},
              'personal',
              'personal',
              ${startMidnight},
              ${endEod},
              true,
              ${req.covering_user_id},
              false,
              ${userInfo.watch_unit},
              ${auth.userID}
            )
          `;
        }
      }
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
    if (req.type === "toil" && req.toil_hours) {
      try {
        const fy = new Date(req.start_date).getMonth() >= 3
          ? new Date(req.start_date).getFullYear()
          : new Date(req.start_date).getFullYear() - 1;

        // toil_ledger.incident_date is a DATE column. The pg serializer
        // rejects a full ISO datetime ("2026-04-25T00:00:00.000Z") with
        // "error serializing parameter: trailing input" — the same bug
        // we hit on the earn endpoint. Strip down to YYYY-MM-DD before
        // binding so the INSERT actually succeeds and the spent row
        // gets recorded (otherwise Sam's balance never gets deducted).
        const startStr = String(req.start_date);
        const dateOnly = (startStr.includes("T")
          ? startStr.split("T")[0]
          : startStr
        ).slice(0, 10);

        await db.rawQuery(
          `INSERT INTO toil_ledger (user_id, type, hours, status, reason, shift_adjustment_id, incident_date, financial_year, watch_unit, created_by)
           VALUES ($1, 'spent', $2, 'approved', $3, $4, $5::date, $6, $7, $8)`,
          targetUserId,
          req.toil_hours,
          `TOIL shift – covered by ${req.covering_name || "cover"}`,
          adjustment.id,
          dateOnly,
          fy,
          userInfo.watch_unit,
          auth.userID
        );
      } catch (err) {
        // Don't re-throw: the shift_adjustment row is already committed
        // at this point so re-throwing would leave an orphaned adjustment
        // without a corresponding spent ledger row. Log loudly instead so
        // the failure shows up in the deploy logs and can be reconciled
        // by deleting + recreating the adjustment (which the new ledger-
        // delete endpoint covers).
        console.error("Failed to deduct TOIL hours from ledger:", err);
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
