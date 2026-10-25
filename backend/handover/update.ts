import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { loadHandovers, saveHandoverItems } from "./items";
import type { UpdateHandoverRequest, Handover } from "./types";

export const update = api<UpdateHandoverRequest, Handover>(
  { auth: true, expose: true, method: "PATCH", path: "/handovers/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<{ id: number; written_by_user_id: string; watch: string; shift_type: "Day" | "Night"; shift_date: Date | string }>`
      SELECT id, written_by_user_id, watch, shift_type, shift_date FROM handovers WHERE id = ${req.id}
    `;

    if (!existing) {
      throw APIError.notFound("handover not found");
    }

    if (existing.written_by_user_id !== auth.userID && auth.role !== "WC") {
      throw APIError.permissionDenied("only the author or a Watch Commander can edit this handover");
    }

    const row = await db.queryRow<{ id: number }>`
      UPDATE handovers SET
        incidents = COALESCE(${req.incidents ?? null}, incidents),
        outstanding_tasks = COALESCE(${req.outstanding_tasks ?? null}, outstanding_tasks),
        equipment_notes = COALESCE(${req.equipment_notes ?? null}, equipment_notes),
        staff_notes = COALESCE(${req.staff_notes ?? null}, staff_notes),
        general_notes = COALESCE(${req.general_notes ?? null}, general_notes),
        updated_at = NOW()
      WHERE id = ${req.id}
      RETURNING id
    `;

    if (!row) {
      throw APIError.internal("failed to update handover");
    }

    if (req.items !== undefined) {
      const shiftDate = existing.shift_date instanceof Date ? existing.shift_date.toISOString().slice(0, 10) : String(existing.shift_date).slice(0, 10);
      await saveHandoverItems(
        { id: existing.id, watch: existing.watch, shift_type: existing.shift_type, shift_date: shiftDate },
        req.items,
        auth.userID
      );
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_handover",
      entity_type: "handover",
      entity_id: req.id.toString(),
      details: {},
    });

    return (await loadHandovers("WHERE h.id = $1", [req.id])).handovers[0];
  }
);
