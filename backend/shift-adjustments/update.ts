import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { ShiftAdjustment } from "./types";

export interface UpdateShiftAdjustmentRequest {
  id: number;
  start_date?: Date;
  end_date?: Date;
  covering_user_id?: string;
  covering_name?: string;
  covering_watch?: string;
  shift_day_night?: "Day" | "Night";
  notes?: string;
}

export const update = api<UpdateShiftAdjustmentRequest, ShiftAdjustment>(
  { auth: true, expose: true, method: "PATCH", path: "/shift-adjustments/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<ShiftAdjustment & { covering_user_id: string | null }>`
      SELECT * FROM shift_adjustments WHERE id = ${req.id}
    `;

    if (!existing) throw APIError.notFound("Shift adjustment not found.");

    // Only the owner or a WC/CC can edit
    const isOwn = existing.user_id === auth.userID;
    const isManager = auth.role === "WC" || auth.role === "CC";
    if (!isOwn && !isManager) {
      throw APIError.permissionDenied("You can only edit your own shift adjustments.");
    }

    // Build dynamic SET clause
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (req.start_date !== undefined) {
      setClauses.push(`start_date = $${idx++}`);
      params.push(req.start_date);
    }
    if (req.end_date !== undefined) {
      setClauses.push(`end_date = $${idx++}`);
      params.push(req.end_date);
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

    // ── Update calendar events to reflect new dates ──────────────────────────
    if (req.start_date || req.end_date) {
      const oldStartStr = typeof existing.start_date === "string"
        ? existing.start_date
        : (existing.start_date as Date).toISOString().split("T")[0];
      const oldEndStr = typeof existing.end_date === "string"
        ? existing.end_date
        : (existing.end_date as Date).toISOString().split("T")[0];
      const oldStartMidnight = `${oldStartStr}T00:00:00.000Z`;
      const oldEndEod = `${oldEndStr}T23:59:59.999Z`;

      const newStartStr = req.start_date
        ? (typeof req.start_date === "string" ? req.start_date : (req.start_date as Date).toISOString().split("T")[0])
        : oldStartStr;
      const newEndStr = req.end_date
        ? (typeof req.end_date === "string" ? req.end_date : (req.end_date as Date).toISOString().split("T")[0])
        : oldEndStr;
      const newStartMidnight = `${newStartStr}T00:00:00.000Z`;
      const newEndEod = `${newEndStr}T23:59:59.999Z`;

      // Update all calendar events that match the old dates for this user
      await db.rawQuery(
        `UPDATE calendar_events SET
          start_time = $1::timestamptz,
          end_time = $2::timestamptz,
          updated_at = NOW()
        WHERE all_day = true
          AND start_time = $3::timestamptz
          AND end_time = $4::timestamptz
          AND (user_id = $5 OR created_by = $5)`,
        newStartMidnight, newEndEod, oldStartMidnight, oldEndEod, existing.user_id
      );

      // For H4H: also update covering person's event
      if (existing.type === "h4h" && existing.covering_user_id) {
        await db.rawQuery(
          `UPDATE calendar_events SET
            start_time = $1::timestamptz,
            end_time = $2::timestamptz,
            updated_at = NOW()
          WHERE all_day = true
            AND start_time = $3::timestamptz
            AND end_time = $4::timestamptz
            AND user_id = $5`,
          newStartMidnight, newEndEod, oldStartMidnight, oldEndEod, existing.covering_user_id
        );
      }
    }

    // ── Update H4H covering person name on calendar events if changed ────────
    if (existing.type === "h4h" && req.covering_name) {
      const userInfo = await db.queryRow<{ name: string }>`SELECT name FROM users WHERE id = ${existing.user_id}`;
      if (userInfo) {
        const startStr = typeof updated.start_date === "string"
          ? updated.start_date
          : (updated.start_date as Date).toISOString().split("T")[0];
        const endStr = typeof updated.end_date === "string"
          ? updated.end_date
          : (updated.end_date as Date).toISOString().split("T")[0];

        // Update watch calendar event title
        await db.rawQuery(
          `UPDATE calendar_events SET
            title = $1,
            updated_at = NOW()
          WHERE all_day = true
            AND start_time = $2::timestamptz
            AND end_time = $3::timestamptz
            AND calendar_visibility = 'watch'
            AND user_id = $4`,
          `${userInfo.name} – H4H (covered by ${req.covering_name})`,
          `${startStr}T00:00:00.000Z`,
          `${endStr}T23:59:59.999Z`,
          existing.user_id
        );

        // Update personal calendar event title
        await db.rawQuery(
          `UPDATE calendar_events SET
            title = $1,
            updated_at = NOW()
          WHERE all_day = true
            AND start_time = $2::timestamptz
            AND end_time = $3::timestamptz
            AND calendar_visibility = 'personal'
            AND user_id = $4`,
          `H4H – Off (covered by ${req.covering_name})`,
          `${startStr}T00:00:00.000Z`,
          `${endStr}T23:59:59.999Z`,
          existing.user_id
        );
      }
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
