import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import db from "../db";
import log from "encore.dev/log";

export const nightlyRollup = api(
  { expose: false, method: "POST", path: "/automation/nightly-rollup" },
  async (): Promise<void> => {
    log.info("Starting nightly target rollup");

    const today = new Date();
    let updatedCount = 0;

    const targets = await db.rawQueryAll<{
      id: number;
      metric: string;
      status: string;
      period_start: Date;
      period_end: Date;
      target_count: number;
      actual_count: number;
    }>(`
      SELECT id, metric, status, period_start, period_end, target_count, actual_count
      FROM targets
      WHERE status IN ('active', 'at_risk')
    `);

    for (const target of targets) {
      let actualCount = 0;

      if (target.metric === "HighRise" || target.metric === "Hydrants") {
        const inspectionType = target.metric === "HighRise" ? "HighRise" : "Hydrant";
        const result = await db.rawQueryRow<{ count: number }>(`
          SELECT COUNT(*) as count
          FROM inspections
          WHERE type = $1
            AND status = 'Complete'
            AND completed_date >= $2
            AND completed_date <= $3
        `, inspectionType, target.period_start, target.period_end);
        
        actualCount = result?.count || 0;
      } else if (target.metric === "HFSV") {
        actualCount = target.actual_count;
      } else if (target.metric === "Activities") {
        actualCount = target.actual_count;
      }

      let newStatus = target.status;
      const progress = target.target_count > 0 ? (actualCount / target.target_count) * 100 : 0;
      
      if (target.period_end < today) {
        newStatus = progress >= 100 ? "completed" : "overdue";
      } else if (progress >= 100) {
        newStatus = "completed";
      } else if (progress >= 80) {
        newStatus = "active";
      } else if (progress >= 50) {
        newStatus = "at_risk";
      } else {
        newStatus = "at_risk";
      }

      if (actualCount !== target.actual_count || newStatus !== target.status) {
        await db.rawQuery(`
          UPDATE targets
          SET actual_count = $1, status = $2, updated_at = NOW()
          WHERE id = $3
        `, actualCount, newStatus, target.id);
        updatedCount++;
        
        log.info(`Updated target ${target.id}: ${target.metric} - Actual: ${actualCount}/${target.target_count}, Status: ${newStatus}`);
      }
    }

    const inspections = await db.rawQueryAll<{
      id: number;
      status: string;
      scheduled_for: Date;
    }>(`
      SELECT id, status, scheduled_for
      FROM inspections
      WHERE status = 'Planned'
    `);

    for (const inspection of inspections) {
      if (inspection.scheduled_for < today) {
        await db.rawQuery(`
          UPDATE inspections
          SET status = 'InProgress', updated_at = NOW()
          WHERE id = $1
        `, inspection.id);
        updatedCount++;
      }
    }

    log.info(`Nightly rollup completed. Updated ${updatedCount} records`);
  }
);

const cronJob = new CronJob("nightly-rollup", {
  title: "Nightly Target Rollup",
  schedule: "0 2 * * *",
  endpoint: nightlyRollup,
});
