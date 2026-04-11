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

    const adjustment = await db.queryRow<ShiftAdjustment>`
      INSERT INTO shift_adjustments (
        user_id, type, start_date, end_date,
        covering_user_id, covering_name,
        covering_watch, shift_day_night,
        toil_hours,
        watch_unit, notes, created_by_user_id
      ) VALUES (
        ${targetUserId},
        ${req.type},
        ${req.start_date},
        ${req.end_date},
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

    if (!adjustment) throw APIError.internal("Failed to create shift adjustment.");

    // ── Create calendar events ────────────────────────────────────────────────
    try {
      const startMidnight = new Date(req.start_date);
      startMidnight.setUTCHours(0, 0, 0, 0);
      const endEod = new Date(req.end_date);
      endEod.setUTCHours(23, 59, 59, 999);

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
                ? `H4H – Off (covered by ${req.covering_name || "cover"})`
                : req.type === "toil"
                ? `TOIL – Off ${req.toil_hours}hrs (covered by ${req.covering_name || "cover"})`
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
                ? `${userInfo.name} – H4H (covered by ${req.covering_name || "cover"})`
                : req.type === "toil"
                ? `${userInfo.name} – TOIL ${req.toil_hours}hrs (covered by ${req.covering_name || "cover"})`
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
                ? `TOIL – Covering for ${userInfo.name} (${userInfo.watch_unit} Watch) — ${req.toil_hours}hrs`
                : `H4H – Covering for ${userInfo.name} (${userInfo.watch_unit} Watch)`},
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

        await db.rawQuery(
          `INSERT INTO toil_ledger (user_id, type, hours, status, reason, shift_adjustment_id, incident_date, financial_year, watch_unit, created_by)
           VALUES ($1, 'spent', $2, 'approved', $3, $4, $5, $6, $7, $8)`,
          targetUserId,
          req.toil_hours,
          `TOIL shift – covered by ${req.covering_name || "cover"}`,
          adjustment.id,
          req.start_date,
          fy,
          userInfo.watch_unit,
          auth.userID
        );
      } catch (err) {
        console.error("Failed to deduct TOIL hours:", err);
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
      const dateRange = startStr === endStr ? startStr : `${startStr} – ${endStr}`;

      let message = `${userInfo.name} has logged a ${typeLabel} for ${dateRange}.`;
      if (req.type === "h4h") {
        message += ` Covered by: ${req.covering_name || "an unknown cover"}.`;
      } else if (req.type === "toil") {
        message += ` ${req.toil_hours}hrs TOIL used. Covered by: ${req.covering_name || "an unknown cover"}.`;
      } else if (isFlexiPayback) {
        message += ` They will cover ${notifyWatch} Watch (${req.shift_day_night ?? "Day"} Shift).`;
      } else if (req.type === "orange_day") {
        message += ` ${req.shift_day_night ?? "Day"} Shift.`;
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
