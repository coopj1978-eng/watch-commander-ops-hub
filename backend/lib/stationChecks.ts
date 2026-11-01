import db from "../db";
import log from "encore.dev/log";
import { rruleFiresOn } from "./rrule";
import { routineRuleFires } from "./routine";
import { addDaysIso, shiftSlot, slotAt, ukInstant, watchForSlot } from "./shiftRota";

/**
 * Station checks from templates (shift board, Oct 2026). Each active template
 * makes cards that belong to the STATION (no watch), so whichever watch is on
 * duty sees and ticks them:
 *   - "every shift" (per_shift): a card for the day shift and one for the
 *     night shift of each day its rule fires — due at the end of that shift
 *     (shift_only limits it to one of them, e.g. Monday's night routine);
 *   - otherwise one card per day the rule fires (the rota day runs 08:00 to
 *     08:00), due when the next one is made — so a weekly/monthly/quarterly
 *     check stays on every shift until it's done, and a daily one lasts the day.
 * Making a check's next card — or its due time passing — marks its earlier
 * unfinished card Missed, so missed checks never pile up. Weekly routine and
 * every-shift cards are due when their shift ends (then Missed and off the
 * board); monthly and quarterly routine cards belong to the watch on duty
 * and stay on that watch's board until done, due when the next one comes. Idempotent (unique template + date + shift),
 * so it runs hourly and whenever the shift board is opened.
 */
/** "{date}" and "{shift}" in a template's card title become the day and shift, e.g. "Mon 2 Nov" / "Night". */
export function fillTitle(template: string, dateIso: string, shift: "day" | "night", perShift: boolean): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
  return template
    .replace(/\{date\}/gi, day)
    .replace(/\{shift\}/gi, perShift ? (shift === "day" ? "Day" : "Night") : "")
    .replace(/\s+([—–-])\s*$/, "")
    .trim();
}

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
    shift_only: "day" | "night" | null;
    routine_slot: string | null;
    routine_rule: string | null;
    cover: string | null;
    created_by: string;
    created_at: Date | null;
  }>(`SELECT * FROM task_templates WHERE is_active = true`);

  let created = 0;
  for (const t of templates) {
    if (!rruleFiresOn(t.rrule, slot.date, t.created_at)) continue;
    // A weekday's night routine isn't made on the day shift, and vice versa.
    if (t.per_shift && t.shift_only && t.shift_only !== slot.type) continue;
    // Monthly / quarterly routine cards only come round in their week.
    if (t.routine_slot && t.routine_slot !== "every" && !routineRuleFires(t.routine_rule, slot.date)) continue;

    const shiftKey = t.per_shift ? slot.type : "";
    let due: Date;
    const monthlyRoutine = !!t.routine_slot && t.routine_slot !== "every" && !!t.routine_rule && t.routine_rule !== "weekly";
    if (monthlyRoutine) {
      // A monthly or quarterly routine card stays with the watch whose shift it
      // came on until they've done it (John, Nov 2026) — never moved onto
      // another watch — and only counts as missed when its next one comes round.
      let next: string | null = null;
      for (let i = 1; i <= 400 && !next; i++) {
        const d = addDaysIso(slot.date, i);
        if (rruleFiresOn(t.rrule, d, t.created_at) && routineRuleFires(t.routine_rule, d)) next = d;
      }
      due = next ? shiftSlot(next, slot.type).start : ukInstant(addDaysIso(slot.date, 120), 8);
    } else if (t.per_shift) {
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
        `INSERT INTO tasks (title, description, category, assigned_by, priority, checklist, rrule, status, watch_unit, source_type, due_at, tags, cover_colour)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'NotStarted', $11, 'template', $8, $9, $10)
         RETURNING id`,
        fillTitle(t.title_template, slot.date, slot.type, t.per_shift), t.task_description ?? null, t.category, t.created_by, t.priority, checklist, t.rrule, due,
        t.routine_slot ? ["routine"] : null, t.cover ?? null,
        // A monthly / quarterly card belongs to the watch on duty when it comes
        // round: if they don't finish it, it stays on their board, not the next watch's.
        monthlyRoutine ? watchForSlot(slot)?.watch ?? null : null
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

  // A check whose time is up is Missed: an every-shift or routine card when
  // its shift ends, a daily/weekly/monthly one when its next card is due.
  // (Making the next card does the same, but a weekday's routine only comes
  // round again next week, and a deleted template's cards would never go.)
  await db.rawExec(
    `UPDATE tasks SET status = 'Missed', updated_at = NOW()
     WHERE source_type = 'template'
       AND status NOT IN ('Done', 'Missed') AND due_at IS NOT NULL AND due_at <= $1`,
    now
  ).catch((err) => log.error("Retiring expired station checks failed", { error: String(err) }));
  return { created };
}
