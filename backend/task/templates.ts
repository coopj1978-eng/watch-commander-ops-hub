import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { cleanRoutineItems, mergeChecklist, routineSlotSpec } from "../lib/routine";
import type { TaskTemplate, TaskCategory, TaskPriority, ChecklistItem } from "./types";

interface ListTemplatesResponse {
  templates: TaskTemplate[];
}

interface CreateTemplateRequest {
  name: string;
  description?: string;
  title_template: string;
  task_description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  checklist?: ChecklistItem[];
  rrule: string;
  per_shift?: boolean;
}

interface UpdateTemplateRequest {
  id: number;
  name?: string;
  description?: string;
  title_template?: string;
  task_description?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  checklist?: ChecklistItem[];
  rrule?: string;
  per_shift?: boolean;
  is_active?: boolean;
}

interface DeleteTemplateRequest {
  id: number;
}

export const listTemplates = api<void, ListTemplatesResponse>(
  { auth: true, expose: true, method: "GET", path: "/task-templates" },
  async () => {
    const rawTemplates = await db.rawQueryAll<any>(
      `SELECT * FROM task_templates ORDER BY created_at DESC`
    );
    const templates: TaskTemplate[] = rawTemplates.map((t) => ({
      ...t,
      checklist: typeof t.checklist === "string" ? JSON.parse(t.checklist) : (t.checklist ?? []),
    }));
    return { templates };
  }
);

export const createTemplate = api<CreateTemplateRequest, TaskTemplate>(
  { auth: true, expose: true, method: "POST", path: "/task-templates" },
  async (req) => {
    const auth = getAuthData()!;
    if (!["WC", "CC"].includes(auth.role)) {
      throw APIError.permissionDenied("only Watch Commanders and Crew Commanders can create templates");
    }

    const raw = await db.rawQueryRow<any>(
      `INSERT INTO task_templates
         (name, description, title_template, task_description, category, priority, checklist, rrule, created_by, per_shift)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      req.name,
      req.description ?? null,
      req.title_template,
      req.task_description ?? null,
      req.category,
      req.priority,
      JSON.stringify(req.checklist ?? []),
      req.rrule,
      auth.userID,
      req.per_shift ?? false
    );

    if (!raw) throw new Error("Failed to create template");
    return {
      ...raw,
      checklist: typeof raw.checklist === "string" ? JSON.parse(raw.checklist) : (raw.checklist ?? []),
    };
  }
);

export const updateTemplate = api(
  { auth: true, expose: true, method: "PATCH", path: "/task-templates/:id" },
  async (params: UpdateTemplateRequest): Promise<TaskTemplate> => {
    const auth = getAuthData()!;
    if (!["WC", "CC"].includes(auth.role)) {
      throw APIError.permissionDenied("only Watch Commanders and Crew Commanders can update templates");
    }

    const { id, ...updates } = params;
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) { setClauses.push(`name = $${paramIndex++}`); queryParams.push(updates.name); }
    if (updates.description !== undefined) { setClauses.push(`description = $${paramIndex++}`); queryParams.push(updates.description); }
    if (updates.title_template !== undefined) { setClauses.push(`title_template = $${paramIndex++}`); queryParams.push(updates.title_template); }
    if (updates.task_description !== undefined) { setClauses.push(`task_description = $${paramIndex++}`); queryParams.push(updates.task_description); }
    if (updates.category !== undefined) { setClauses.push(`category = $${paramIndex++}`); queryParams.push(updates.category); }
    if (updates.priority !== undefined) { setClauses.push(`priority = $${paramIndex++}`); queryParams.push(updates.priority); }
    if (updates.checklist !== undefined) { setClauses.push(`checklist = $${paramIndex++}`); queryParams.push(JSON.stringify(updates.checklist)); }
    if (updates.rrule !== undefined) { setClauses.push(`rrule = $${paramIndex++}`); queryParams.push(updates.rrule); }
    if (updates.is_active !== undefined) { setClauses.push(`is_active = $${paramIndex++}`); queryParams.push(updates.is_active); }
    if (updates.per_shift !== undefined) { setClauses.push(`per_shift = $${paramIndex++}`); queryParams.push(updates.per_shift); }

    if (setClauses.length === 0) throw APIError.invalidArgument("no updates provided");

    setClauses.push(`updated_at = NOW()`);
    queryParams.push(id);

    const raw = await db.rawQueryRow<any>(
      `UPDATE task_templates SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      ...queryParams
    );
    if (!raw) throw APIError.notFound("template not found");
    if (updates.checklist !== undefined) await syncOpenCards(id, updates.checklist);

    return {
      ...raw,
      checklist: typeof raw.checklist === "string" ? JSON.parse(raw.checklist) : (raw.checklist ?? []),
    };
  }
);

export const deleteTemplate = api<DeleteTemplateRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/task-templates/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    if (!["WC", "CC"].includes(auth.role)) {
      throw APIError.permissionDenied("only Watch Commanders and Crew Commanders can delete templates");
    }
    // Its unfinished cards come off the board too (kept as Missed, not deleted).
    await db.rawExec(
      `UPDATE tasks SET status = 'Missed', updated_at = NOW()
       WHERE id IN (SELECT task_id FROM task_template_instances WHERE template_id = $1)
         AND status NOT IN ('Done', 'Missed')`,
      id
    );
    await db.rawQueryAll(`DELETE FROM task_templates WHERE id = $1`, id);
  }
);

/**
 * A changed checklist also reaches the template's cards already on the board
 * (say an item is added to Monday's routine on a Monday): ticks are kept,
 * new items arrive unticked.
 */
async function syncOpenCards(templateId: number, checklist: ChecklistItem[]): Promise<void> {
  const cards = await db.rawQueryAll<{ id: number; checklist: unknown }>(
    `SELECT t.id, t.checklist FROM tasks t
     JOIN task_template_instances i ON i.task_id = t.id
     WHERE i.template_id = $1 AND t.status NOT IN ('Done', 'Missed')`,
    templateId
  );
  for (const c of cards) {
    const current: ChecklistItem[] = typeof c.checklist === "string" ? JSON.parse(c.checklist) : ((c.checklist as ChecklistItem[]) ?? []);
    const next = mergeChecklist(Array.isArray(current) ? current : [], checklist);
    // Emptied and nothing ticked: the card has nothing left to do, so it goes.
    if (next.length === 0) await db.rawExec(`DELETE FROM tasks WHERE id = $1`, c.id);
    else await db.rawExec(`UPDATE tasks SET checklist = $1, updated_at = NOW() WHERE id = $2`, JSON.stringify(next), c.id);
  }
}

// ─── Weekly routine (the Routines planner) ───────────────────────────────────

interface SaveRoutineRequest {
  /** 'every' or a weekday + shift, e.g. 'MO-day', 'FR-night'. */
  slot: string;
  /** The slot's items, in order. An empty list switches the slot off. */
  items: string[];
}

// PUT /task-templates/routine/:slot — set one slot's items (WC/CC)
export const saveRoutine = api<SaveRoutineRequest, { template: TaskTemplate | null }>(
  { auth: true, expose: true, method: "PUT", path: "/task-templates/routine/:slot" },
  async ({ slot, items }) => {
    const auth = getAuthData()!;
    if (!["WC", "CC"].includes(auth.role)) {
      throw APIError.permissionDenied("only Watch Commanders and Crew Commanders can change the routine");
    }
    const spec = routineSlotSpec(slot);
    if (!spec) throw APIError.invalidArgument("unknown routine slot");
    const checklist = cleanRoutineItems(Array.isArray(items) ? items : []);

    const existing = await db.rawQueryRow<{ id: number }>(
      `SELECT id FROM task_templates WHERE routine_slot = $1`, slot
    );
    let raw: any;
    if (existing) {
      raw = await db.rawQueryRow<any>(
        `UPDATE task_templates SET checklist = $1, is_active = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        JSON.stringify(checklist), checklist.length > 0, existing.id
      );
      await syncOpenCards(existing.id, checklist);
    } else {
      if (checklist.length === 0) return { template: null };
      raw = await db.rawQueryRow<any>(
        `INSERT INTO task_templates
           (name, description, title_template, category, priority, checklist, rrule, created_by, per_shift, shift_only, routine_slot)
         VALUES ($1, NULL, $2, 'Other', 'Med', $3, $4, $5, true, $6, $7)
         ON CONFLICT (routine_slot) WHERE routine_slot IS NOT NULL
         DO UPDATE SET checklist = EXCLUDED.checklist, is_active = true, updated_at = NOW()
         RETURNING *`,
        spec.name, spec.title, JSON.stringify(checklist), spec.rrule, auth.userID, spec.shift_only, slot
      );
    }
    return { template: { ...raw, checklist: typeof raw.checklist === "string" ? JSON.parse(raw.checklist) : (raw.checklist ?? []) } };
  }
);
