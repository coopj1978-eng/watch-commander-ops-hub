import db from "../db";
import log from "encore.dev/log";
import { rruleFiresOn } from "./rrule";
import { addDaysIso, slotAt, ukInstant } from "./shiftRota";

/**
 * Station checks from templates (shift board, Oct 2026). Each active template
 * makes cards that belong to the STATION (no watch), so whichever watch is on
 * duty sees and ticks them:
 *   - "every shift" (per_shift): a card for the day shift and one for the
 *     night shift of each day its rule fires — due at the end of that shift;
 *   - otherwise one card per day the rule fires (the rota day runs 08:00 to
 *     08:00), due when the next one is made — so a weekly/monthly/quarterly
 *     check stays on every shift until it's done, and a daily one lasts the day.
 * Making a check's next card marks its earlier unfinished card Missed, so
 * missed checks never pile up. Idempotent (unique template + date + shift),
 * so it runs hourly and whenever the shift board is opened.
 */
export async function ensureStationChecks(now: Date = new Date()): Promise<{ created: number }> {
  const slot = slotAt(now);
  const templates = await db.rawQueryAll<{
    id: number;
    title_template: string;
    task_description: string | null;
    category: string;
    priority: string;
    checklist: unknown;
    rrule: string;
    per_shift: boolean;
    created_by: string;
    created_at: Date | null;
  }>(`SELECT * FROM task_templates WHERE is_active = true`);

  let created = 0;
  for (const t of templates) {
    if (!rruleFiresOn(t.rrule, slot.date, t.created_at)) continue;

    const shiftKey = t.per_shift ? slot.type : "";
    let due: Date;
    if (t.per_shift) {
      due = slot.end;
    } else {
      // Due when the next one is made (08:00 on the rule's next day), or by
      // the end of the rota day for a rule that doesn't come round again.
      let next: string | null = null;
      for (let i = 1; i <= 400 && !next; i++) {
        const d = addDaysIso(slot.date, i);
        if (rruleFiresOn(t.rrule, d, t.created_at)) next = d;
      }
      due = ukInstant(next ?? addDaysIso(slot.date, 1), 8);
    }

    const exists = await db.rawQueryRow<{ id: number }>(
      `SELECT id FROM task_template_instances WHERE template_id = $1 AND generated_for_date = $2 AND generated_for_shift = $3`,
      t.id, slot.date, shiftKey
    );
    if (exists) continue;

    const checklist = t.checklist ? (typeof t.checklist === "string" ? t.checklist : JSON.stringify(t.checklist)) : "[]";

    // Card + instance row together; if a concurrent run already claimed this
    // slot the instance insert returns nothing and our card is rolled back.
    const tx = await db.begin();
    try {
      const task = await tx.rawQueryRow<{ id: number }>(
        `INSERT INTO tasks (title, description, category, assigned_by, priority, checklist, rrule, status, watch_unit, source_type, due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'NotStarted', NULL, 'template', $8)
         RETURNING id`,
        t.title_template, t.task_description ?? null, t.category, t.created_by, t.priority, checklist, t.rrule, due
      );
      const instance = task && await tx.rawQueryRow<{ id: number }>(
        `INSERT INTO task_template_instances (template_id, task_id, generated_for_date, generated_for_shift)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (template_id, generated_for_date, generated_for_shift) DO NOTHING
         RETURNING id`,
        t.id, task.id, slot.date, shiftKey
      );
      if (!task || !instance) {
        await tx.rollback();
        continue;
      }
      await tx.rawExec(
        `UPDATE tasks SET status = 'Missed', updated_at = NOW()
         WHERE id IN (SELECT task_id FROM task_template_instances WHERE template_id = $1 AND task_id <> $2)
           AND status NOT IN ('Done', 'Missed')`,
        t.id, task.id
      );
      await tx.commit();
      created++;
    } catch (err) {
      await tx.rollback().catch(() => {});
      log.error("Station check generation failed", { template_id: t.id, error: String(err) });
    }
  }
  if (created) log.info("Station checks made", { created, date: slot.date, shift: slot.type });
  return { created };
}
