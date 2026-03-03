import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission } from "../auth/rbac";
import { Permission } from "../auth/rbac";
import type {
  InspectionAssignment,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResponse,
  ListAssignmentsRequest,
  ListAssignmentsResponse,
  UpdateAssignmentRequest,
  WatchName,
} from "./types";

const ALL_WATCHES: WatchName[] = ["Red", "White", "Green", "Blue", "Amber"];

// POST /inspection-plans/assignments/generate
// WC/CC only — reads the 4 plan tables and creates assignments for the given year.
// Passing quarter= limits multi-story to that quarter only; omitting it generates all quarters.
// Care homes always generate annual assignments (quarter = null) for ALL watches.
// Hydrants + OIs generate annual assignments for their own watch field.
// Uses ON CONFLICT DO NOTHING so it is safe to re-run.
export const generateAssignments = api(
  { auth: true, expose: true, method: "POST", path: "/inspection-plans/assignments/generate" },
  async (req: GenerateAssignmentsRequest): Promise<GenerateAssignmentsResponse> => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.MANAGE_ALL_INSPECTIONS);

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
      for (const [q, watch] of quarters) {
        if (!watch) continue;
        if (req.quarter !== undefined && req.quarter !== q) continue;
        const result = await db.rawQueryRow<{ id: number }>(
          `INSERT INTO inspection_assignments (plan_type, plan_id, label, watch, year, quarter)
           VALUES ('multistory', $1, $2, $3, $4, $5)
           ON CONFLICT (plan_type, plan_id, watch, year, COALESCE(quarter, 0)) DO NOTHING
           RETURNING id`,
          row.id, row.address, watch, req.year, q
        );
        result ? created++ : skipped++;
      }
    }

    // ── Care Homes (annual — ALL watches) ────────────────────────────────────
    // Only generate annual when no quarter filter is specified, or always for care homes
    if (req.quarter === undefined) {
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
            row.id, row.address, watch, req.year
          );
          result ? created++ : skipped++;
        }
      }

      // ── Hydrants (annual — own watch) ─────────────────────────────────────
      const hydrants = await db.rawQueryAll<{ id: number; area_code: string; street: string; section: string; watch: string | null }>(
        `SELECT id, area_code, street, section, watch FROM hydrant_registers`
      );
      for (const row of hydrants) {
        if (!row.watch) continue;
        const label = `${row.area_code} – ${row.street}, ${row.section}`;
        const result = await db.rawQueryRow<{ id: number }>(
          `INSERT INTO inspection_assignments (plan_type, plan_id, label, watch, year, quarter)
           VALUES ('hydrant', $1, $2, $3, $4, NULL)
           ON CONFLICT (plan_type, plan_id, watch, year, COALESCE(quarter, 0)) DO NOTHING
           RETURNING id`,
          row.id, label, row.watch, req.year
        );
        result ? created++ : skipped++;
      }

      // ── Operational Inspections (annual — own watch) ──────────────────────
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
          row.id, label, row.watch, req.year
        );
        result ? created++ : skipped++;
      }
    }

    return { created, skipped };
  }
);

// GET /inspection-plans/assignments
// Returns assignments filtered by optional watch, year, quarter, plan_type, status.
export const listAssignments = api(
  { auth: true, expose: true, method: "GET", path: "/inspection-plans/assignments" },
  async (req: ListAssignmentsRequest): Promise<ListAssignmentsResponse> => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (req.watch)     { conditions.push(`watch = $${idx++}`);     values.push(req.watch); }
    if (req.year)      { conditions.push(`year = $${idx++}`);      values.push(req.year); }
    if (req.plan_type) { conditions.push(`plan_type = $${idx++}`); values.push(req.plan_type); }
    if (req.status)    { conditions.push(`status = $${idx++}`);    values.push(req.status); }

    // quarter filter: null means "annual only", a number means that quarter
    if (req.quarter !== undefined) {
      if (req.quarter === 0) {
        conditions.push(`quarter IS NULL`);
      } else {
        conditions.push(`quarter = $${idx++}`);
        values.push(req.quarter);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const items = await db.rawQueryAll<InspectionAssignment>(
      `SELECT * FROM inspection_assignments ${where} ORDER BY plan_type, watch, quarter NULLS LAST, label`,
      ...values
    );

    const pending  = items.filter(i => i.status === "pending").length;
    const complete = items.filter(i => i.status === "complete").length;

    return { items, totals: { pending, complete } };
  }
);

// PATCH /inspection-plans/assignments/:id
// WC/CC only — marks an assignment complete or reverts it to pending.
export const updateAssignment = api(
  { auth: true, expose: true, method: "PATCH", path: "/inspection-plans/assignments/:id" },
  async (req: { id: number } & UpdateAssignmentRequest): Promise<InspectionAssignment> => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.MANAGE_ALL_INSPECTIONS);

    const completedAt  = req.status === "complete" ? "now()" : "NULL";

    const row = await db.rawQueryRow<InspectionAssignment>(
      `UPDATE inspection_assignments
       SET status       = $1,
           notes        = COALESCE($2, notes),
           completed_at = ${completedAt},
           updated_at   = now()
       WHERE id = $3
       RETURNING *`,
      req.status,
      req.notes ?? null,
      req.id
    );

    if (!row) throw new Error("Assignment not found");
    return row;
  }
);
