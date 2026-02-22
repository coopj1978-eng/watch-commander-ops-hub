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
        COALESCE(SUM(CASE WHEN a.absence_type = 'sickness' THEN (a.end_date - a.start_date + 1) ELSE 0 END), 0) as sick_days,
        COALESCE(SUM(CASE WHEN a.absence_type = 'AL' THEN (a.end_date - a.start_date + 1) ELSE 0 END), 0) as vacation_days,
        COALESCE(SUM(CASE WHEN a.absence_type NOT IN ('sickness', 'AL') THEN (a.end_date - a.start_date + 1) ELSE 0 END), 0) as other_days,
        COALESCE(SUM(CASE WHEN a.start_date >= ${sixMonthsAgo} THEN (a.end_date - a.start_date + 1) ELSE 0 END), 0) as six_month_total
      FROM absences a
      WHERE a.firefighter_id = ${user_id} AND a.status = 'approved'
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
