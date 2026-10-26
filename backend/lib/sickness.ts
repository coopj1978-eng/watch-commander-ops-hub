import { APIError } from "encore.dev/api";
import db from "../db";
import { rollingSickness, type DutyDayCheck, type SicknessRow, type TriggerStage } from "./sicknessMath";
import { watchShiftOn } from "./shiftRota";
import { notifyTriggersHit } from "./absenceAccess";

export { ukTodayIso } from "./sicknessMath";

const STAGE_RANK: Record<TriggerStage, number> = { None: 0, Stage1: 1, Stage2: 2, Stage3: 3 };

/** Was a date one of this person's rostered shifts? Undefined when their watch has no rota. */
export async function dutyDayCheckFor(userId: string): Promise<DutyDayCheck> {
  const row = await db.queryRow<{ watch: string | null }>`
    SELECT COALESCE(u.watch_unit, fp.watch) AS watch
    FROM users u LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
    WHERE u.id = ${userId}
  `;
  const watch = row?.watch;
  if (!watch || !watchShiftOn(watch, "2026-01-01")) return undefined;
  return (iso) => {
    const s = watchShiftOn(watch, iso);
    return s === "1st Day" || s === "2nd Day" || s === "1st Night" || s === "2nd Night";
  };
}

/** Recompute and store rolling sickness + trigger stage (episodes / duty days in 6 months) for one person. */
export async function recalcTriggersForUser(userId: string) {
  const rows: SicknessRow[] = [];
  for await (const r of db.query<SicknessRow>`
    SELECT start_date, end_date, returned_to_work_at
    FROM absences
    WHERE firefighter_id = ${userId} AND type = 'sickness' AND status = 'approved'
  `) {
    rows.push(r);
  }

  const { episodes, days } = rollingSickness(rows, undefined, await dutyDayCheckFor(userId));

  const s = await db.queryRow<{
    trigger_stage1_episodes: number; trigger_stage1_days: number;
    trigger_stage2_episodes: number; trigger_stage2_days: number;
    trigger_stage3_episodes: number; trigger_stage3_days: number;
  }>`SELECT * FROM system_settings ORDER BY id DESC LIMIT 1`;

  let stage: TriggerStage = "None";
  if (s) {
    if (episodes >= s.trigger_stage3_episodes || days >= s.trigger_stage3_days) stage = "Stage3";
    else if (episodes >= s.trigger_stage2_episodes || days >= s.trigger_stage2_days) stage = "Stage2";
    else if (episodes >= s.trigger_stage1_episodes || days >= s.trigger_stage1_days) stage = "Stage1";
  }

  // Lock the row while reading the old stage so two recalculations at once
  // can't both see the rise and notify twice.
  const previous = await db.queryRow<{ trigger_stage: TriggerStage | null }>`
    UPDATE firefighter_profiles fp
       SET rolling_sick_episodes = ${episodes},
           rolling_sick_days = ${days},
           trigger_stage = ${stage},
           updated_at = NOW()
      FROM (SELECT trigger_stage FROM firefighter_profiles WHERE user_id = ${userId} FOR UPDATE) prev
     WHERE fp.user_id = ${userId}
    RETURNING prev.trigger_stage
  `;

  const previousStage = previous?.trigger_stage ?? "None";
  if (previous && STAGE_RANK[stage] > STAGE_RANK[previousStage]) {
    await notifyTriggersHit(userId, { episodes, days, further: previousStage !== "None" });
  }
  return {
    rolling_sick_episodes: episodes,
    rolling_sick_days: days,
    trigger_stage: stage,
    previous_trigger_stage: previousStage,
    changed: previousStage !== stage,
  };
}

/** Never let a trigger recalculation failure break the sickness action that caused it. */
export async function recalcTriggersSafely(userId: string) {
  try {
    await recalcTriggersForUser(userId);
  } catch (err) {
    console.error(`Trigger recalculation failed for ${userId}:`, err);
  }
}

/** Refuse a new sickness while the person already has one open — book them back fit (or edit it) instead. */
export async function assertNoOpenSickness(userId: string) {
  const open = await db.queryRow<{ start_date: Date | string }>`
    SELECT start_date FROM absences
     WHERE firefighter_id = ${userId}
       AND type = 'sickness'
       AND status IN ('approved', 'pending')
       AND returned_to_work_at IS NULL
     ORDER BY start_date DESC
     LIMIT 1
  `;
  if (open) {
    const since = new Date(open.start_date).toLocaleDateString("en-GB");
    throw APIError.failedPrecondition(
      `Already booked sick since ${since}. Book them back fit or edit that record instead of logging a new one.`
    );
  }
}
