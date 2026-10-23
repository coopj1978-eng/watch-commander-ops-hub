import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import db from "../db";
import { recalcTriggersSafely } from "../lib/sickness";

// Rolling six-month sickness totals change with time alone: open sicknesses
// accrue a day each day and old episodes age out of the window.
export const recalcAllTriggers = api(
  { expose: false, method: "POST", path: "/absences/internal/recalc-all-triggers" },
  async (): Promise<{ recalculated: number }> => {
    let count = 0;
    for await (const row of db.query<{ user_id: string }>`
      SELECT user_id FROM firefighter_profiles WHERE user_id IS NOT NULL
    `) {
      await recalcTriggersSafely(row.user_id);
      count++;
    }
    return { recalculated: count };
  }
);

const _recalcTriggersCron = new CronJob("recalc-sickness-triggers", {
  title: "Recalculate rolling sickness triggers",
  schedule: "15 3 * * *",
  endpoint: recalcAllTriggers,
});
