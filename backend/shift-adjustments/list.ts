import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { ShiftAdjustment } from "./types";

interface ListShiftAdjustmentsRequest {
  user_id?:       Query<string>;
  watch_unit?:    Query<string>;
  covering_watch?: Query<string>;
  start_date?:    Query<string>;
  end_date?:      Query<string>;
}

interface ListShiftAdjustmentsResponse {
  adjustments: ShiftAdjustment[];
}

export const list = api<ListShiftAdjustmentsRequest, ListShiftAdjustmentsResponse>(
  { auth: true, expose: true, method: "GET", path: "/shift-adjustments" },
  async (req) => {
    let query = `
      SELECT sa.*, u.name AS user_name
      FROM shift_adjustments sa
      JOIN users u ON u.id = sa.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (req.user_id) {
      query += ` AND sa.user_id = $${idx++}`;
      params.push(req.user_id);
    }
    if (req.watch_unit) {
      query += ` AND sa.watch_unit = $${idx++}`;
      params.push(req.watch_unit);
    }
    if (req.covering_watch) {
      query += ` AND sa.covering_watch = $${idx++}`;
      params.push(req.covering_watch);
    }
    if (req.start_date) {
      query += ` AND sa.end_date >= $${idx++}`;
      params.push(req.start_date);
    }
    if (req.end_date) {
      query += ` AND sa.start_date <= $${idx++}`;
      params.push(req.end_date);
    }

    query += " ORDER BY sa.start_date DESC";

    const adjustments = await db.rawQueryAll<ShiftAdjustment>(query, ...params);
    return { adjustments };
  }
);
