import { api } from "encore.dev/api";
import db from "../db";
import type { AbsenceStats } from "./types";

interface GetStatsRequest {
  user_id: string;
}

export const getStats = api<GetStatsRequest, AbsenceStats>(
  { expose: true, method: "GET", path: "/absences/stats/:user_id" },
  async ({ user_id }) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const stats = await db.queryRow<{
      sick_days: number;
      vacation_days: number;
      other_days: number;
      six_month_total: number;
    }>`
      SELECT
        COALESCE(SUM(CASE WHEN absence_type = 'sick' THEN (end_date - start_date + 1) ELSE 0 END), 0) as sick_days,
        COALESCE(SUM(CASE WHEN absence_type = 'vacation' THEN (end_date - start_date + 1) ELSE 0 END), 0) as vacation_days,
        COALESCE(SUM(CASE WHEN absence_type NOT IN ('sick', 'vacation') THEN (end_date - start_date + 1) ELSE 0 END), 0) as other_days,
        COALESCE(SUM(CASE WHEN start_date >= ${sixMonthsAgo} THEN (end_date - start_date + 1) ELSE 0 END), 0) as six_month_total
      FROM absences
      WHERE user_id = ${user_id} AND status = 'approved'
    `;

    const sixMonthTotal = stats?.six_month_total || 0;
    let stageAlert: string | undefined;

    if (sixMonthTotal >= 15) {
      stageAlert = "Stage 3 - Critical";
    } else if (sixMonthTotal >= 10) {
      stageAlert = "Stage 2 - Warning";
    } else if (sixMonthTotal >= 5) {
      stageAlert = "Stage 1 - Monitor";
    }

    return {
      user_id,
      total_days: (stats?.sick_days || 0) + (stats?.vacation_days || 0) + (stats?.other_days || 0),
      sick_days: stats?.sick_days || 0,
      vacation_days: stats?.vacation_days || 0,
      other_days: stats?.other_days || 0,
      six_month_total: sixMonthTotal,
      stage_alert: stageAlert,
    };
  }
);
