import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db, { type SQLPrimitive } from "../db";
import { logActivity } from "../logging/logger";
import type { ShiftAdjustment } from "./types";
import {
  canModifyAdjustment,
  deleteAdjustmentEvents,
  financialYearOf,
  insertAdjustmentEvents,
  loadAdjustment,
  spentReasonFor,
  toDateOnly,
} from "./events";

export interface UpdateShiftAdjustmentRequest {
  id: number;
  start_date?: Date;
  end_date?: Date;
  covering_user_id?: string;
  covering_name?: string;
  covering_watch?: string;
  shift_day_night?: "Day" | "Night";
  /** TOIL only: hours used for this shift (min 4). */
  toil_hours?: number;
  notes?: string;
}

export const update = api<UpdateShiftAdjustmentRequest, ShiftAdjustment>(
  { auth: true, expose: true, method: "PATCH", path: "/shift-adjustments/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await loadAdjustment(req.id);
    if (!existing) throw APIError.notFound("Shift adjustment not found.");

    if (!canModifyAdjustment(existing, auth)) {
      throw APIError.permissionDenied(
        "Only the person it belongs to, the person covering it, or a WC/CC can edit this."
      );
    }

    const newStart = req.start_date !== undefined ? toDateOnly(req.start_date) : toDateOnly(existing.start_date);
    const newEnd = req.end_date !== undefined ? toDateOnly(req.end_date) : toDateOnly(existing.end_date);
    if (newEnd < newStart) {
      throw APIError.invalidArgument("End date must be on or after start date.");
    }

    // ── TOIL hours / balance check ───────────────────────────────────────────
    const isToil = existing.type === "toil";
    if (req.toil_hours !== undefined && !isToil) {
      throw APIError.invalidArgument("Hours can only be changed on a TOIL adjustment.");
    }
    if (isToil && req.toil_hours !== undefined && req.toil_hours < 4) {
      throw APIError.invalidArgument("TOIL requires a minimum of 4 hours.");
    }
    const newHours = isToil
      ? Number(req.toil_hours ?? existing.toil_hours ?? 0)
      : null;
    const newFy = financialYearOf(newStart);
    if (isToil && newHours) {
      // Carried-over balance across all years, excluding this adjustment's
      // own spent row so it isn't double-counted.
      const balanceRow = await db.rawQueryRow<{ balance: string }>(
        `SELECT COALESCE(SUM(CASE WHEN type = 'earned' AND status = 'approved' THEN hours ELSE 0 END) -
                SUM(CASE WHEN type = 'spent' THEN hours ELSE 0 END), 0) AS balance
         FROM toil_ledger
         WHERE user_id = $1
           AND NOT (type = 'spent' AND shift_adjustment_id = $2)`,
        existing.user_id,
        req.id
      );
      const available = Number(balanceRow?.balance ?? 0);
      if (available < newHours) {
        throw APIError.failedPrecondition(
          `Insufficient TOIL balance. Available: ${available}hrs, requested: ${newHours}hrs.`
        );
      }
    }

    // ── Update the adjustment row ────────────────────────────────────────────
    const setClauses: string[] = [];
    const params: SQLPrimitive[] = [];
    let idx = 1;

    if (req.start_date !== undefined) {
      setClauses.push(`start_date = $${idx++}::date`);
      params.push(newStart);
    }
    if (req.end_date !== undefined) {
      setClauses.push(`end_date = $${idx++}::date`);
      params.push(newEnd);
    }
    if (req.covering_user_id !== undefined) {
      setClauses.push(`covering_user_id = $${idx++}`);
      params.push(req.covering_user_id || null);
    }
    if (req.covering_name !== undefined) {
      setClauses.push(`covering_name = $${idx++}`);
      params.push(req.covering_name || null);
    }
    if (req.covering_watch !== undefined) {
      setClauses.push(`covering_watch = $${idx++}`);
      params.push(req.covering_watch || null);
    }
    if (req.shift_day_night !== undefined) {
      setClauses.push(`shift_day_night = $${idx++}`);
      params.push(req.shift_day_night);
    }
    if (req.toil_hours !== undefined) {
      setClauses.push(`toil_hours = $${idx++}`);
      params.push(req.toil_hours);
    }
    if (req.notes !== undefined) {
      setClauses.push(`notes = $${idx++}`);
      params.push(req.notes || null);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("No fields to update.");
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(req.id);

    const query = `UPDATE shift_adjustments SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`;
    const updated = await db.rawQueryRow<ShiftAdjustment>(query, ...params);
    if (!updated) throw APIError.internal("Failed to update shift adjustment.");

    // ── Rebuild calendar events ──────────────────────────────────────────────
    // Dates, cover person, shift or hours all feed into event dates/titles
    // (and who gets the cover event), so the simplest correct move is to
    // replace the linked events with freshly generated ones.
    const affectsEvents =
      req.start_date !== undefined ||
      req.end_date !== undefined ||
      req.covering_user_id !== undefined ||
      req.covering_name !== undefined ||
      req.covering_watch !== undefined ||
      req.shift_day_night !== undefined ||
      req.toil_hours !== undefined;

    if (affectsEvents) {
      const owner = await db.queryRow<{ name: string }>`
        SELECT name FROM users WHERE id = ${existing.user_id}
      `;
      try {
        await deleteAdjustmentEvents(existing);
        await insertAdjustmentEvents(updated, {
          name: owner?.name ?? "Unknown",
          watch_unit: existing.watch_unit,
        });
      } catch (err) {
        console.error("Failed to rebuild shift adjustment calendar events:", err);
        throw APIError.unavailable(
          "The adjustment was saved but its calendar entries couldn't be updated. Please try again."
        );
      }
    }

    // ── Keep the TOIL spent ledger row in step ───────────────────────────────
    if (isToil && newHours) {
      const coverName = req.covering_name !== undefined ? req.covering_name : existing.covering_name;
      await db.rawExec(
        `UPDATE toil_ledger SET
           hours          = $1,
           incident_date  = $2::date,
           financial_year = $3,
           reason         = $4,
           updated_at     = NOW()
         WHERE shift_adjustment_id = $5 AND type = 'spent'`,
        newHours,
        newStart,
        newFy,
        spentReasonFor(coverName),
        req.id
      );
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_shift_adjustment",
      entity_type: "shift_adjustment",
      entity_id: req.id.toString(),
      details: { type: existing.type },
    });

    return updated;
  }
);
