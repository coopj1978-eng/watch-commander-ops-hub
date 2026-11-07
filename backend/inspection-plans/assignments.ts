import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db, { type SQLPrimitive } from "../db";
import { requirePermission } from "../auth/rbac";
import { Permission } from "../auth/rbac";
import { createAssignments } from "../lib/inspectionAssignments";
import type {
  InspectionAssignment,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResponse,
  ListAssignmentsRequest,
  ListAssignmentsResponse,
  UpdateAssignmentRequest,
} from "./types";

// POST /inspection-plans/assignments/generate
// WC/CC only — creates assignments for the given year from the plan tables. A new year
// also gets them by itself on 1 January; see lib/inspectionAssignments.ts for both.
export const generateAssignments = api(
  { auth: true, expose: true, method: "POST", path: "/inspection-plans/assignments/generate" },
  async (req: GenerateAssignmentsRequest): Promise<GenerateAssignmentsResponse> => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.MANAGE_ALL_INSPECTIONS);
    return createAssignments(req.year, req.quarter);
  }
);

// GET /inspection-plans/assignments
// Returns assignments filtered by optional watch, year, quarter, plan_type, status.
export const listAssignments = api(
  { auth: true, expose: true, method: "GET", path: "/inspection-plans/assignments" },
  async (req: ListAssignmentsRequest): Promise<ListAssignmentsResponse> => {
    const conditions: string[] = [];
    const values: SQLPrimitive[] = [];
    let idx = 1;

    // Defensive: Encore passes GET query params as strings — coerce to numbers
    const year    = req.year    !== undefined ? Number(req.year)    : undefined;
    const quarter = req.quarter !== undefined ? Number(req.quarter) : undefined;

    if (req.watch)     { conditions.push(`watch = $${idx++}`);     values.push(req.watch); }
    if (year !== undefined && !isNaN(year) && year > 0) {
      conditions.push(`year = $${idx++}`);
      values.push(year);
    }
    if (req.plan_type) { conditions.push(`plan_type = $${idx++}`); values.push(req.plan_type); }
    if (req.status)    { conditions.push(`status = $${idx++}`);    values.push(req.status); }

    // quarter filter: 0 means "annual only" (quarter IS NULL), a number means that quarter
    if (quarter !== undefined && !isNaN(quarter)) {
      if (quarter === 0) {
        conditions.push(`quarter IS NULL`);
      } else {
        conditions.push(`quarter = $${idx++}`);
        values.push(quarter);
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
// Side-effect: if the assignment is multistory, recalculates the HighRise target
// actual_count for the assignment's year so the Targets dashboard stays in sync.
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

    // ── Auto-update HighRise target actual_count ─────────────────────────────
    // When a multi-story assignment is toggled, count all completed multi-story
    // assignments for the same year and push that total into any
    // HighRise target rows whose period overlaps with that year.
    if (row.plan_type === "multistory") {
      const countRow = await db.rawQueryRow<{ n: number }>(
        `SELECT COUNT(*) AS n
         FROM inspection_assignments
         WHERE plan_type = 'multistory' AND year = $1 AND status = 'complete'`,
        row.year
      );
      const completedCount = Number(countRow?.n ?? 0);

      await db.rawQueryAll<{ id: number }>(
        `UPDATE targets
         SET actual_count = $1,
             status = CASE
               WHEN $1 >= target_count THEN 'completed'
               WHEN $1::float / NULLIF(target_count, 0) >= 0.8 THEN 'active'
               WHEN $1::float / NULLIF(target_count, 0) >= 0.5 THEN 'at_risk'
               ELSE 'overdue'
             END,
             updated_at = NOW()
         WHERE metric = 'HighRise'
           AND EXTRACT(YEAR FROM period_start) = $2
         RETURNING id`,
        completedCount,
        row.year
      );
    }

    return row;
  }
);
