import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { ensureStationChecks } from "../lib/stationChecks";
import { sendBackToWorkReminders } from "../lib/backToWork";

// Hourly: station checks from templates (lib/stationChecks.ts), and back to
// work interview reminders once someone's first shift back has started
// (lib/backToWork.ts).
export const generateTasksFromTemplates = api(
  { expose: false, method: "POST", path: "/automation/generate-template-tasks" },
  async (): Promise<void> => {
    await ensureStationChecks();
    await sendBackToWorkReminders();
  }
);

const _cronJob = new CronJob("generate-template-tasks", {
  title: "Station checks from templates",
  schedule: "5 * * * *", // hourly — catches the 08:00 and 18:00 shift changes
  endpoint: generateTasksFromTemplates,
});
