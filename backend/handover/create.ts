import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateHandoverRequest, Handover } from "./types";

interface DBHandover {
  id: number;
  watch: string;
  shift_type: string;
  shift_date: Date | string;
  written_by_user_id: string;
  incidents?: string;
  outstanding_tasks?: string;
  equipment_notes?: string;
  staff_notes?: string;
  general_notes: string;
  created_at: Date;
  updated_at: Date;
}

function transformHandover(row: DBHandover, authorName?: string): Handover {
  const shiftDate =
    typeof row.shift_date === "string"
      ? row.shift_date.split("T")[0]
      : row.shift_date.toISOString().split("T")[0];

  return {
    id: row.id,
    watch: row.watch,
    shift_type: row.shift_type as "Day" | "Night",
    shift_date: shiftDate,
    written_by_user_id: row.written_by_user_id,
    written_by_name: authorName,
    incidents: row.incidents ?? undefined,
    outstanding_tasks: row.outstanding_tasks ?? undefined,
    equipment_notes: row.equipment_notes ?? undefined,
    staff_notes: row.staff_notes ?? undefined,
    general_notes: row.general_notes,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

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

    const author = await db.queryRow<{ name: string }>`
      SELECT name FROM users WHERE id = ${auth.userID}
    `;

    const row = await db.queryRow<DBHandover>`
      INSERT INTO handovers (
        watch, shift_type, shift_date, written_by_user_id,
        incidents, outstanding_tasks, equipment_notes, staff_notes, general_notes
      )
      VALUES (
        ${req.watch},
        ${req.shift_type || "Day"},
        ${req.shift_date}::date,
        ${auth.userID},
        ${req.incidents ?? null},
        ${req.outstanding_tasks ?? null},
        ${req.equipment_notes ?? null},
        ${req.staff_notes ?? null},
        ${req.general_notes ?? ""}
      )
      RETURNING *
    `;

    if (!row) {
      throw APIError.internal("failed to create handover");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_handover",
      entity_type: "handover",
      entity_id: row.id.toString(),
      details: { watch: req.watch, shift_date: req.shift_date, shift_type: req.shift_type },
    });

    return transformHandover(row, author?.name);
  }
);
