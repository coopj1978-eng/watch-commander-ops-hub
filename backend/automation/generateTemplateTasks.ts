import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import db from "../db";
import log from "encore.dev/log";

/**
 * Parses an rrule string and determines whether it fires on the given date.
 * Supports FREQ=DAILY, FREQ=WEEKLY (with optional BYDAY), FREQ=MONTHLY (BYMONTHDAY).
 */
function rruleFiresToday(rrule: string, date: Date, templateCreatedAt?: Date | string | null): boolean {
  const parts: Record<string, string> = {};
  rrule.split(";").forEach((part) => {
    const [key, val] = part.split("=");
    if (key && val) parts[key.trim()] = val.trim();
  });

  const freq = parts["FREQ"];
  if (!freq) return false;

  const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const dayOfMonth = date.getDate();

  if (freq === "DAILY") {
    return true;
  }

  if (freq === "WEEKLY") {
    if (parts["BYDAY"]) {
      const byDay = parts["BYDAY"].split(",").map((d) => d.trim());
      return byDay.includes(dayNames[dayOfWeek]);
    }
    // No BYDAY: once a week, on the weekday the template was created (Monday if unknown).
    const created = templateCreatedAt ? new Date(templateCreatedAt) : null;
    const anchorDay = created && !Number.isNaN(created.getTime()) ? created.getDay() : 1;
    return dayOfWeek === anchorDay;
  }

  if (freq === "MONTHLY") {
    if (parts["BYMONTHDAY"]) {
      return parseInt(parts["BYMONTHDAY"]) === dayOfMonth;
    }
    // Default to 1st of month
    return dayOfMonth === 1;
  }

  return false;
}

export const generateTasksFromTemplates = api(
  { expose: false, method: "POST", path: "/automation/generate-template-tasks" },
  async (): Promise<void> => {
    const today = new Date();
    const todayDate = today.toISOString().split("T")[0]; // YYYY-MM-DD
    log.info("Generating tasks from templates", { date: todayDate });

    // The board filters tasks by watch_unit, so generated tasks inherit the
    // template creator's watch — otherwise they'd never appear on any board.
    const rawTemplates = await db.rawQueryAll<{
      id: number;
      title_template: string;
      task_description: string | null;
      category: string;
      priority: string;
      checklist: string | null;
      rrule: string;
      created_by: string;
      created_at: Date | null;
      creator_watch: string | null;
    }>(
      `SELECT t.*, u.watch_unit AS creator_watch
       FROM task_templates t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.is_active = true`
    );

    let created = 0;
    let skipped = 0;

    for (const template of rawTemplates) {
      if (!rruleFiresToday(template.rrule, today, template.created_at)) {
        skipped++;
        continue;
      }

      const existing = await db.rawQueryRow<{ id: number }>(
        `SELECT id FROM task_template_instances WHERE template_id = $1 AND generated_for_date = $2`,
        template.id,
        todayDate
      );
      if (existing) {
        skipped++;
        continue;
      }

      const checklist = template.checklist
        ? (typeof template.checklist === "string" ? template.checklist : JSON.stringify(template.checklist))
        : "[]";

      // Task + instance row in one transaction. If a concurrent run already
      // claimed today's slot, the unique (template_id, generated_for_date)
      // insert returns nothing and we roll back our task — no duplicates.
      const tx = await db.begin();
      try {
        const task = await tx.rawQueryRow<{ id: number }>(
          `INSERT INTO tasks (title, description, category, assigned_by, priority, checklist, rrule, status, watch_unit)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'NotStarted', $8)
           RETURNING id`,
          template.title_template,
          template.task_description ?? null,
          template.category,
          template.created_by,
          template.priority,
          checklist,
          template.rrule,
          template.creator_watch || null
        );
        if (!task) {
          await tx.rollback();
          continue;
        }

        const instance = await tx.rawQueryRow<{ id: number }>(
          `INSERT INTO task_template_instances (template_id, task_id, generated_for_date)
           VALUES ($1, $2, $3)
           ON CONFLICT (template_id, generated_for_date) DO NOTHING
           RETURNING id`,
          template.id,
          task.id,
          todayDate
        );
        if (!instance) {
          await tx.rollback();
          skipped++;
          continue;
        }

        await tx.commit();
        created++;
        log.info("Created task from template", { template_id: template.id, task_id: task.id });
      } catch (err) {
        await tx.rollback().catch(() => {});
        log.error("Template task generation failed", { template_id: template.id, error: String(err) });
      }
    }

    log.info("Template task generation complete", { created, skipped });
  }
);

const _cronJob = new CronJob("generate-template-tasks", {
  title: "Daily Template Task Generator",
  schedule: "0 6 * * *", // 06:00 every day
  endpoint: generateTasksFromTemplates,
});
