import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
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
         (name, description, title_template, task_description, category, priority, checklist, rrule, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      req.name,
      req.description ?? null,
      req.title_template,
      req.task_description ?? null,
      req.category,
      req.priority,
      JSON.stringify(req.checklist ?? []),
      req.rrule,
      auth.userID
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

    if (setClauses.length === 0) throw APIError.invalidArgument("no updates provided");

    setClauses.push(`updated_at = NOW()`);
    queryParams.push(id);

    const raw = await db.rawQueryRow<any>(
      `UPDATE task_templates SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      ...queryParams
    );
    if (!raw) throw APIError.notFound("template not found");

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
    await db.rawQueryAll(`DELETE FROM task_templates WHERE id = $1`, id);
  }
);
