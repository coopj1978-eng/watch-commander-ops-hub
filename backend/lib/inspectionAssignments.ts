import db from "../db";
import { watchInYear } from "./multistoryProgramme";

const ALL_WATCHES = ["Red", "White", "Green", "Blue", "Amber"];

/**
 * Creates a year's inspections from the plan tables. Used by the Generate button and,
 * for a new year, by the daily check below.
 *
 * Passing `quarter` limits multi-story to that quarter and skips the annual items;
 * omitting it generates everything. Multi-story quarters are calendar quarters
 * (Q1 = Jan–Mar), as on the station's programme (John, 7 Nov 2026), so `year` is the
 * calendar year for every plan type. The programme moves along each January, so the
 * plan's watches are moved on to `year` (lib/multistoryProgramme).
 * Care homes always generate annual assignments (quarter = null) for ALL watches.
 * OIs generate annual assignments for their own watch field. Hydrants have their own
 * routes and rota now (backend/hydrants), so the old register no longer makes any.
 * Uses ON CONFLICT DO NOTHING so it is safe to re-run.
 */
export async function createAssignments(
  year: number,
  quarter?: number
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  // ── Multi-Story (quarterly) ──────────────────────────────────────────────
  const multistory = await db.rawQueryAll<{
    id: number; address: string;
    q1_watch: string | null; q2_watch: string | null;
    q3_watch: string | null; q4_watch: string | null;
  }>(`SELECT id, address, q1_watch, q2_watch, q3_watch, q4_watch FROM multistory_inspections`);

  for (const row of multistory) {
    const quarters: Array<[number, string | null]> = [
      [1, row.q1_watch], [2, row.q2_watch], [3, row.q3_watch], [4, row.q4_watch],
    ];
    for (const [q, planWatch] of quarters) {
      if (!planWatch) continue;
      if (quarter !== undefined && quarter !== q) continue;
      const watch = watchInYear(planWatch, year);
      const result = await db.rawQueryRow<{ id: number }>(
        `INSERT INTO inspection_assignments (plan_type, plan_id, label, watch, year, quarter)
         VALUES ('multistory', $1, $2, $3, $4, $5)
         ON CONFLICT (plan_type, plan_id, watch, year, COALESCE(quarter, 0)) DO NOTHING
         RETURNING id`,
        row.id, row.address, watch, year, q
      );
      result ? created++ : skipped++;
    }
  }

  if (quarter === undefined) {
    // ── Care Homes (annual — ALL watches) ──────────────────────────────────
    const careHomes = await db.rawQueryAll<{ id: number; address: string }>(
      `SELECT id, address FROM care_home_validations`
    );
    for (const row of careHomes) {
      for (const watch of ALL_WATCHES) {
        const result = await db.rawQueryRow<{ id: number }>(
          `INSERT INTO inspection_assignments (plan_type, plan_id, label, watch, year, quarter)
           VALUES ('care_home', $1, $2, $3, $4, NULL)
           ON CONFLICT (plan_type, plan_id, watch, year, COALESCE(quarter, 0)) DO NOTHING
           RETURNING id`,
          row.id, row.address, watch, year
        );
        result ? created++ : skipped++;
      }
    }

    // ── Operational Inspections (annual — own watch) ───────────────────────
    const operational = await db.rawQueryAll<{ id: number; address: string; uprn: string; watch: string | null }>(
      `SELECT id, address, uprn, watch FROM operational_inspections`
    );
    for (const row of operational) {
      if (!row.watch) continue;
      const label = row.uprn ? `${row.address} (${row.uprn})` : row.address;
      const result = await db.rawQueryRow<{ id: number }>(
        `INSERT INTO inspection_assignments (plan_type, plan_id, label, watch, year, quarter)
         VALUES ('operational', $1, $2, $3, $4, NULL)
         ON CONFLICT (plan_type, plan_id, watch, year, COALESCE(quarter, 0)) DO NOTHING
         RETURNING id`,
        row.id, label, row.watch, year
      );
      result ? created++ : skipped++;
    }
  }

  return { created, skipped };
}

/**
 * A new year's inspections appear by themselves on 1 January (John, 7 Nov 2026).
 * Run daily so a missed run is caught the next day. It only acts on a year with no
 * inspections at all, so plan changes during the year still wait for someone to
 * press Generate rather than adding rows unannounced.
 */
export async function ensureYearAssignments(now: Date = new Date()): Promise<{ year: number; created: number }> {
  const year = now.getUTCFullYear();
  const started = await db.rawQueryRow<{ id: number }>(
    `SELECT id FROM inspection_assignments WHERE year = $1 LIMIT 1`,
    year
  );
  if (started) return { year, created: 0 };
  const { created } = await createAssignments(year);
  return { year, created };
}
