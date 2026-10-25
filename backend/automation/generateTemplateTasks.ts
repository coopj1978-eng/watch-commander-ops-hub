import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import db from "../db";
import log from "encore.dev/log";
import { ukTodayIso } from "../lib/sicknessMath";
import { rruleFiresOn } from "./rrule";

export const generateTasksFromTemplates = api(
  { expose: false, method: "POST", path: "/automation/generate-template-tasks" },
  async (): Promise<void> => {
    // UK calendar day (YYYY-MM-DD) — the same as the UTC day at the 06:00 UTC
    // cron, and also the key that stops a template generating twice in a day.
    const todayDate = ukTodayIso();
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
      if (!rruleFiresOn(template.rrule, todayDate, template.created_at)) {
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
