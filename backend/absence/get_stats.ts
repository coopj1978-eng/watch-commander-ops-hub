import { api } from "encore.dev/api";
import db from "../db";
import { absenceViewer, assertCanViewAbsencesOf } from "../lib/absenceAccess";
import { dutyDayCheckFor, recalcTriggersForUser } from "../lib/sickness";
import { countDays } from "../lib/sicknessMath";
import type { AbsenceStats } from "./types";

interface GetStatsRequest {
  user_id: string;
}

// Stages are a note the Station Commander puts on the attendance file —
// the app only flags that the absence triggers have been reached.
const TRIGGER_LABEL = "Absence triggers hit — see profile";

export const getStats = api<GetStatsRequest, AbsenceStats>(
  { auth: true, expose: true, method: "GET", path: "/absences/stats/:user_id" },
  async ({ user_id }) => {
    await assertCanViewAbsencesOf(await absenceViewer(), user_id);

    // Days lost = the person's rostered shifts in each absence, not every calendar day.
    const isDutyDay = await dutyDayCheckFor(user_id);
    const totals = { sick_days: 0, vacation_days: 0, other_days: 0 };
    for await (const a of db.query<{ type: string; start_date: Date | string; end_date: Date | string }>`
      SELECT type, start_date, end_date FROM absences
      WHERE firefighter_id = ${user_id} AND status = 'approved'
    `) {
      const iso = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
      const n = countDays(iso(a.start_date), iso(a.end_date), isDutyDay);
      if (a.type === "sickness") totals.sick_days += n;
      else if (a.type === "AL") totals.vacation_days += n;
      else totals.other_days += n;
    }

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
      stage_alert: rolling.trigger_stage !== "None" ? TRIGGER_LABEL : undefined,
    };
  }
);
