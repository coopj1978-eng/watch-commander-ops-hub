import { api } from "encore.dev/api";
import db from "../db";
import { absenceViewer, assertCanViewAbsencesOf } from "../lib/absenceAccess";
import { recalcTriggersForUser } from "../lib/sickness";
import type { AbsenceStats } from "./types";

interface GetStatsRequest {
  user_id: string;
}

const STAGE_LABELS: Record<string, string | undefined> = {
  Stage1: "Stage 1 - Monitor",
  Stage2: "Stage 2 - Warning",
  Stage3: "Stage 3 - Critical",
};

export const getStats = api<GetStatsRequest, AbsenceStats>(
  { auth: true, expose: true, method: "GET", path: "/absences/stats/:user_id" },
  async ({ user_id }) => {
    await assertCanViewAbsencesOf(await absenceViewer(), user_id);

    const totals = await db.queryRow<{
      sick_days: number;
      vacation_days: number;
      other_days: number;
    }>`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'sickness' THEN (end_date - start_date + 1) ELSE 0 END), 0)::int AS sick_days,
        COALESCE(SUM(CASE WHEN type = 'AL' THEN (end_date - start_date + 1) ELSE 0 END), 0)::int AS vacation_days,
        COALESCE(SUM(CASE WHEN type NOT IN ('sickness', 'AL') THEN (end_date - start_date + 1) ELSE 0 END), 0)::int AS other_days
      FROM absences
      WHERE firefighter_id = ${user_id} AND status = 'approved'
    `;

    // Rolling six-month sickness + stage use the same calculation as the
    // sickness triggers so every screen agrees.
    const rolling = await recalcTriggersForUser(user_id);

    const sick = totals?.sick_days ?? 0;
    const vacation = totals?.vacation_days ?? 0;
    const other = totals?.other_days ?? 0;

    return {
      user_id,
      total_days: sick + vacation + other,
      sick_days: sick,
      vacation_days: vacation,
      other_days: other,
      six_month_total: rolling.rolling_sick_days,
      stage_alert: STAGE_LABELS[rolling.trigger_stage],
    };
  }
);
