import { api } from "encore.dev/api";
import db, { type SQLPrimitive } from "../db";
import { ukTodayIso } from "../lib/sicknessMath";
import type { ToilBalanceRequest, ToilBalanceResponse, ToilBalance } from "./types";

// GET /toil/balance — Get TOIL balances for user(s)
//
// TOIL earned is kept until it's used, so `balance` covers every year.
// `total_earned` / `total_spent` are the calendar-year figures, which go
// back to zero on 1 January (dated by the incident / shift date).
export const balance = api<ToilBalanceRequest, ToilBalanceResponse>(
  { auth: true, expose: true, method: "GET", path: "/toil/balance" },
  async (req) => {
    const year = req.year ?? Number(ukTodayIso().slice(0, 4));

    const conditions: string[] = ["TRUE"];
    const values: SQLPrimitive[] = [year];
    let idx = 2;

    if (req.user_id) {
      conditions.push(`t.user_id = $${idx++}`);
      values.push(req.user_id);
    }
    if (req.watch_unit) {
      conditions.push(`LOWER(t.watch_unit) = LOWER($${idx++})`);
      values.push(req.watch_unit);
    }

    const where = conditions.join(" AND ");
    const inYear = `EXTRACT(YEAR FROM COALESCE(t.incident_date, t.created_at)) = $1`;

    const rows = await db.rawQueryAll<{
      user_id: string;
      user_name: string;
      all_earned: string;
      all_spent: string;
      year_earned: string;
      year_spent: string;
      pending_earned: string;
    }>(
      `SELECT
        t.user_id,
        u.name as user_name,
        COALESCE(SUM(CASE WHEN t.type = 'earned' AND t.status = 'approved' THEN t.hours ELSE 0 END), 0) as all_earned,
        COALESCE(SUM(CASE WHEN t.type = 'spent' THEN t.hours ELSE 0 END), 0) as all_spent,
        COALESCE(SUM(CASE WHEN t.type = 'earned' AND t.status = 'approved' AND ${inYear} THEN t.hours ELSE 0 END), 0) as year_earned,
        COALESCE(SUM(CASE WHEN t.type = 'spent' AND ${inYear} THEN t.hours ELSE 0 END), 0) as year_spent,
        COALESCE(SUM(CASE WHEN t.type = 'earned' AND t.status = 'pending' THEN t.hours ELSE 0 END), 0) as pending_earned
      FROM toil_ledger t
      JOIN users u ON t.user_id = u.id
      WHERE ${where}
      GROUP BY t.user_id, u.name
      ORDER BY u.name`,
      ...values
    );

    const balances: ToilBalance[] = rows.map((r) => ({
      user_id: r.user_id,
      user_name: r.user_name,
      year,
      total_earned: Number(r.year_earned),
      total_spent: Number(r.year_spent),
      pending_earned: Number(r.pending_earned),
      balance: Number(r.all_earned) - Number(r.all_spent),
    }));

    return { balances };
  }
);
