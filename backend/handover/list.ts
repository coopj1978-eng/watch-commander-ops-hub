import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { ListHandoversRequest, ListHandoversResponse, Handover } from "./types";

interface DBHandover {
  id: number;
  watch: string;
  shift_type: string;
  shift_date: Date | string;
  written_by_user_id: string;
  author_name?: string;
  incidents?: string;
  outstanding_tasks?: string;
  equipment_notes?: string;
  staff_notes?: string;
  general_notes: string;
  created_at: Date;
  updated_at: Date;
  total: number;
}

interface ListRequest {
  watch?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

function transformHandover(row: DBHandover): Handover {
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
    written_by_name: row.author_name ?? undefined,
    incidents: row.incidents ?? undefined,
    outstanding_tasks: row.outstanding_tasks ?? undefined,
    equipment_notes: row.equipment_notes ?? undefined,
    staff_notes: row.staff_notes ?? undefined,
    general_notes: row.general_notes,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export const list = api<ListRequest, ListHandoversResponse>(
  { auth: true, expose: true, method: "GET", path: "/handovers" },
  async (req) => {
    getAuthData()!;

    const limit = req.limit ?? 20;
    const offset = req.offset ?? 0;

    let rows: DBHandover[];
    let countRow: { count: number } | null;

    if (req.watch) {
      rows = await db.rawQueryAll<DBHandover>(
        `SELECT h.*, u.name AS author_name, COUNT(*) OVER() AS total
         FROM handovers h
         LEFT JOIN users u ON u.id = h.written_by_user_id
         WHERE h.watch = $1
         ORDER BY h.shift_date DESC, h.created_at DESC
         LIMIT $2 OFFSET $3`,
        req.watch,
        limit,
        offset
      );
    } else {
      rows = await db.rawQueryAll<DBHandover>(
        `SELECT h.*, u.name AS author_name, COUNT(*) OVER() AS total
         FROM handovers h
         LEFT JOIN users u ON u.id = h.written_by_user_id
         ORDER BY h.shift_date DESC, h.created_at DESC
         LIMIT $1 OFFSET $2`,
        limit,
        offset
      );
    }

    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    return {
      handovers: rows.map(transformHandover),
      total,
    };
  }
);

interface GetLatestResponse {
  handover: Handover | null;
  found: boolean;
}

export const getLatest = api<{ watch?: Query<string> }, GetLatestResponse>(
  { auth: true, expose: true, method: "GET", path: "/handovers/latest" },
  async (req) => {
    getAuthData()!;

    let row: (DBHandover & { author_name?: string }) | null;

    if (req.watch) {
      row = await db.rawQueryRow<DBHandover>(
        `SELECT h.*, u.name AS author_name
         FROM handovers h
         LEFT JOIN users u ON u.id = h.written_by_user_id
         WHERE h.watch = $1
         ORDER BY h.shift_date DESC, h.created_at DESC
         LIMIT 1`,
        req.watch
      );
    } else {
      row = await db.rawQueryRow<DBHandover>(
        `SELECT h.*, u.name AS author_name
         FROM handovers h
         LEFT JOIN users u ON u.id = h.written_by_user_id
         ORDER BY h.shift_date DESC, h.created_at DESC
         LIMIT 1`
      );
    }

    if (!row) return { handover: null, found: false };
    return { handover: transformHandover(row), found: true };
  }
);
