import { api } from "encore.dev/api";
import db from "../db";
import type { ToilBalanceRequest, ToilBalanceResponse, ToilBalance } from "./types";

/** Financial year (April-start). */
function currentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

// GET /toil/balance — Get TOIL balances for user(s)
export const balance = api<ToilBalanceRequest, ToilBalanceResponse>(
  { auth: true, expose: true, method: "GET", path: "/toil/balance" },
  async (req) => {
    const fy = req.financial_year ?? currentFinancialYear();

    const conditions: string[] = [`t.financial_year = $1`];
    const values: unknown[] = [fy];
    let idx = 2;

    if (req.user_id) {
      conditions.push(`t.user_id = $${idx++}`);
      values.push(req.user_id);
    }
    if (req.watch_unit) {
      conditions.push(`t.watch_unit = $${idx++}`);
      values.push(req.watch_unit);
    }

    const where = conditions.join(" AND ");

    const rows = await db.rawQueryAll<{
      user_id: string;
      user_name: string;
      total_earned: string;
      total_spent: string;
      pending_earned: string;
    }>(
      `SELECT
        t.user_id,
        u.name as user_name,
        COALESCE(SUM(CASE WHEN t.type = 'earned' AND t.status = 'approved' THEN t.hours ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN t.type = 'spent' THEN t.hours ELSE 0 END), 0) as total_spent,
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
      financial_year: fy,
      total_earned: Number(r.total_earned),
      total_spent: Number(r.total_spent),
      pending_earned: Number(r.pending_earned),
      balance: Number(r.total_earned) - Number(r.total_spent),
    }));

    return { balances };
  }
);
