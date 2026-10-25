import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { loadHandovers, nextShiftFor, saveHandoverItems } from "./items";
import type { CreateHandoverRequest, Handover } from "./types";

export const create = api<CreateHandoverRequest, Handover>(
  { auth: true, expose: true, method: "POST", path: "/handovers" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.watch) {
      throw APIError.invalidArgument("watch is required");
    }
    if (!req.shift_date) {
      throw APIError.invalidArgument("shift_date is required");
    }
    const shiftType = req.shift_type || "Day";
    // Who it's for: the watch on the next shift, from the rota.
    const nextWatch = nextShiftFor(req.shift_date, shiftType).watch;

    const row = await db.queryRow<{ id: number }>`
      INSERT INTO handovers (
        watch, shift_type, shift_date, written_by_user_id,
        incidents, outstanding_tasks, equipment_notes, staff_notes, general_notes, next_watch
      )
      VALUES (
        ${req.watch},
        ${shiftType},
        ${req.shift_date}::date,
        ${auth.userID},
        ${req.incidents ?? null},
        ${req.outstanding_tasks ?? null},
        ${req.equipment_notes ?? null},
        ${req.staff_notes ?? null},
        ${req.general_notes ?? ""},
        ${nextWatch}
      )
      RETURNING id
    `;

    if (!row) {
      throw APIError.internal("failed to create handover");
    }

    await saveHandoverItems(
      { id: row.id, watch: req.watch, shift_type: shiftType, shift_date: req.shift_date },
      req.items,
      auth.userID
    );

    await logActivity({
      user_id: auth.userID,
      action: "create_handover",
      entity_type: "handover",
      entity_id: row.id.toString(),
      details: { watch: req.watch, shift_date: req.shift_date, shift_type: shiftType, items: req.items?.length ?? 0 },
    });

    return (await loadHandovers("WHERE h.id = $1", [row.id])).handovers[0];
  }
);
