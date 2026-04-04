import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateHandoverRequest, Handover } from "./types";

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

export const update = api<UpdateHandoverRequest, Handover>(
  { auth: true, expose: true, method: "PATCH", path: "/handovers/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<{ id: number; written_by_user_id: string }>`
      SELECT id, written_by_user_id FROM handovers WHERE id = ${req.id}
    `;

    if (!existing) {
      throw APIError.notFound("handover not found");
    }

    if (existing.written_by_user_id !== auth.userID && auth.role !== "WC") {
      throw APIError.permissionDenied("only the author or a Watch Commander can edit this handover");
    }

    const row = await db.queryRow<DBHandover>`
      UPDATE handovers SET
        incidents = COALESCE(${req.incidents ?? null}, incidents),
        outstanding_tasks = COALESCE(${req.outstanding_tasks ?? null}, outstanding_tasks),
        equipment_notes = COALESCE(${req.equipment_notes ?? null}, equipment_notes),
        staff_notes = COALESCE(${req.staff_notes ?? null}, staff_notes),
        general_notes = COALESCE(${req.general_notes ?? null}, general_notes),
        updated_at = NOW()
      WHERE id = ${req.id}
      RETURNING *
    `;

    if (!row) {
      throw APIError.internal("failed to update handover");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_handover",
      entity_type: "handover",
      entity_id: req.id.toString(),
      details: {},
    });

    const shiftDate =
      typeof row.shift_date === "string"
        ? row.shift_date.split("T")[0]
        : row.shift_date.toISOString().split("T")[0];

    const author = await db.queryRow<{ name: string }>`
      SELECT name FROM users WHERE id = ${row.written_by_user_id}
    `;

    return {
      id: row.id,
      watch: row.watch,
      shift_type: row.shift_type as "Day" | "Night",
      shift_date: shiftDate,
      written_by_user_id: row.written_by_user_id,
      written_by_name: author?.name,
      incidents: row.incidents ?? undefined,
      outstanding_tasks: row.outstanding_tasks ?? undefined,
      equipment_notes: row.equipment_notes ?? undefined,
      staff_notes: row.staff_notes ?? undefined,
      general_notes: row.general_notes,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }
);
