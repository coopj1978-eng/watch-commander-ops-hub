import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { ROUTINE_RULES, cleanRoutineItems, mergeChecklist, routineSlotSpec } from "../lib/routine";
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

interface RoutineCardInput {
  /** The planner's own id for a card it hasn't saved yet — echoed back with the new id. */
  key?: string;
  /** Set for a card that's already saved. */
  id?: number;
  name: string;
  /** 'weekly' (default) | 'first' | 'last' | 'quarter-last'. Ignored for every-shift cards. */
  rule?: string;
  /** null = automatic header; else a colour id, image URL or uploaded picture (data URL). */
  cover?: string | null;
  items: string[];
}

interface SaveRoutineRequest {
  /** 'every' or a weekday + shift, e.g. 'MO-day', 'FR-night'. */
  slot: string;
  /** The slot's cards, in order. Cards left out are removed. */
  cards: RoutineCardInput[];
}

interface SaveRoutineResponse {
  cards: TaskTemplate[];
  keys: { key: string; id: number }[];
}

const MAX_COVER = 400_000; // characters — an uploaded header, resized in the browser

function cleanCover(cover: string | null | undefined): string | null {
  const c = (cover ?? "").trim();
  if (!c) return null;
  if (c.length > MAX_COVER) throw APIError.invalidArgument("That header picture is too big — try a smaller one.");
  if (c.startsWith("data:image/") || /^https?:\/\//.test(c) || /^#?[a-z0-9-]{1,40}$/i.test(c)) return c;
  throw APIError.invalidArgument("Unrecognised header.");
}

const parseTemplate = (raw: any): TaskTemplate => ({
  ...raw,
  checklist: typeof raw.checklist === "string" ? JSON.parse(raw.checklist) : (raw.checklist ?? []),
});

// PUT /task-templates/routine/:slot — set one slot's cards (WC/CC). Each card
// is a template; cards on today's board pick up name, header and item changes
// (ticks are kept), and a card taken out of the planner leaves the board if
// nobody has ticked anything on it yet.
export const saveRoutine = api<SaveRoutineRequest, SaveRoutineResponse>(
  { auth: true, expose: true, method: "PUT", path: "/task-templates/routine/:slot" },
  async ({ slot, cards }) => {
    const auth = getAuthData()!;
    if (!["WC", "CC"].includes(auth.role)) {
      throw APIError.permissionDenied("only Watch Commanders and Crew Commanders can change the routine");
    }
    const spec = routineSlotSpec(slot);
    if (!spec) throw APIError.invalidArgument("unknown routine slot");
    const input = (Array.isArray(cards) ? cards : []).slice(0, 12);

    const existing = await db.rawQueryAll<{ id: number; checklist: unknown }>(
      `SELECT id, checklist FROM task_templates WHERE routine_slot = $1`, slot
    );
    const existingIds = new Set(existing.map((e) => e.id));
    const keys: { key: string; id: number }[] = [];
    const kept = new Set<number>();

    for (const [position, card] of input.entries()) {
      const name = String(card.name ?? "").trim().slice(0, 80) || spec.name;
      const rule = slot === "every" ? "weekly" : (ROUTINE_RULES as readonly string[]).includes(card.rule ?? "") ? card.rule! : "weekly";
      const cover = cleanCover(card.cover);
      const checklist = cleanRoutineItems(Array.isArray(card.items) ? card.items : []);

      if (card.id && existingIds.has(card.id)) {
        await db.rawExec(
          `UPDATE task_templates
           SET name = $1, title_template = $1, checklist = $2, routine_rule = $3, cover = $4,
               routine_position = $5, is_active = $6, updated_at = NOW()
           WHERE id = $7`,
          name, JSON.stringify(checklist), rule, cover, position, checklist.length > 0, card.id
        );
        await syncOpenCards(card.id, checklist);
        await db.rawExec(
          `UPDATE tasks SET title = $1, cover_colour = $2, updated_at = NOW()
           WHERE id IN (SELECT task_id FROM task_template_instances WHERE template_id = $3)
             AND status NOT IN ('Done', 'Missed')`,
          name, cover, card.id
        );
        kept.add(card.id);
        if (card.key) keys.push({ key: card.key, id: card.id });
      } else {
        const row = await db.rawQueryRow<{ id: number }>(
          `INSERT INTO task_templates
             (name, description, title_template, category, priority, checklist, rrule, created_by, per_shift, shift_only,
              routine_slot, routine_rule, cover, routine_position, is_active)
           VALUES ($1, NULL, $1, 'Other', 'Med', $2, $3, $4, true, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          name, JSON.stringify(checklist), spec.rrule, auth.userID, spec.shift_only, slot, rule, cover, position, checklist.length > 0
        );
        if (row) {
          kept.add(row.id);
          if (card.key) keys.push({ key: card.key, id: row.id });
        }
      }
    }

    // Cards taken out: their untouched cards come off the board, then the template goes.
    for (const e of existing) {
      if (kept.has(e.id)) continue;
      const open = await db.rawQueryAll<{ id: number; checklist: unknown }>(
        `SELECT t.id, t.checklist FROM tasks t JOIN task_template_instances i ON i.task_id = t.id
         WHERE i.template_id = $1 AND t.status NOT IN ('Done', 'Missed')`,
        e.id
      );
      for (const c of open) {
        const list: ChecklistItem[] = typeof c.checklist === "string" ? JSON.parse(c.checklist) : ((c.checklist as ChecklistItem[]) ?? []);
        if (!list.some((i) => i.done)) await db.rawExec(`DELETE FROM tasks WHERE id = $1`, c.id);
      }
      await db.rawExec(`DELETE FROM task_templates WHERE id = $1`, e.id);
    }

    const rows = await db.rawQueryAll<any>(
      `SELECT * FROM task_templates WHERE routine_slot = $1 ORDER BY routine_position, id`, slot
    );
    return { cards: rows.map(parseTemplate), keys };
  }
);
