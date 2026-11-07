import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { ensureYearAssignments } from "../lib/inspectionAssignments";

// Makes a new year's inspections just after midnight on 1 January, or the next
// morning it runs if that was missed (lib/inspectionAssignments.ts).
export const ensureYearInspections = api(
  { expose: false, method: "POST", path: "/inspection-plans/internal/ensure-year" },
  async (): Promise<{ year: number; created: number }> => ensureYearAssignments()
);

const _ensureYearCron = new CronJob("ensure-year-inspections", {
  title: "Create the new year's inspections",
  schedule: "5 0 * * *",
  endpoint: ensureYearInspections,
});
