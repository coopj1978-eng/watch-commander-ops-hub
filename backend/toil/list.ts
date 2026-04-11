import { api } from "encore.dev/api";
import db from "../db";
import type { ListToilRequest, ListToilResponse, ToilEntry } from "./types";

// GET /toil — List TOIL entries with optional filters
export const list = api<ListToilRequest, ListToilResponse>(
  { auth: true, expose: true, method: "GET", path: "/toil" },
  async (req) => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (req.user_id) {
      conditions.push(`t.user_id = $${idx++}`);
      values.push(req.user_id);
    }
    if (req.watch_unit) {
      conditions.push(`t.watch_unit = $${idx++}`);
      values.push(req.watch_unit);
    }
    if (req.financial_year) {
      conditions.push(`t.financial_year = $${idx++}`);
      values.push(req.financial_year);
    }
    if (req.status) {
      conditions.push(`t.status = $${idx++}`);
      values.push(req.status);
    }
    if (req.type) {
      conditions.push(`t.type = $${idx++}`);
      values.push(req.type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const entries = await db.rawQueryAll<ToilEntry & { user_name: string; approved_by_name: string | null }>(
      `SELECT t.*, u.name as user_name, a.name as approved_by_name
       FROM toil_ledger t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.approved_by_user_id = a.id
       ${where}
       ORDER BY t.created_at DESC`,
      ...values
    );

    return { entries };
  }
);
