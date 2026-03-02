import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { TaskColumn } from "./types";

interface ListColumnsResponse {
  columns: TaskColumn[];
}

interface CreateColumnRequest {
  name: string;
  status_key: string;
  color?: string;
}

interface UpdateColumnRequest {
  id: number;
  name?: string;
  color?: string;
}

interface DeleteColumnRequest {
  id: number;
}

interface ReorderColumnsRequest {
  columns: { id: number; position: number }[];
}

export const listColumns = api<void, ListColumnsResponse>(
  { auth: true, expose: true, method: "GET", path: "/task-columns" },
  async () => {
    const columns = await db.rawQueryAll<TaskColumn>(
      `SELECT * FROM task_columns ORDER BY position ASC, id ASC`
    );
    return { columns };
  }
);

export const createColumn = api<CreateColumnRequest, TaskColumn>(
  { auth: true, expose: true, method: "POST", path: "/task-columns" },
  async (req) => {
    const auth = getAuthData()!;
    if (!["WC", "CC"].includes(auth.role)) {
      throw APIError.permissionDenied("only Watch Commanders and Crew Commanders can manage columns");
    }

    // Get max position
    const maxRow = await db.rawQueryRow<{ max: number | null }>(
      `SELECT MAX(position) as max FROM task_columns`
    );
    const nextPosition = (maxRow?.max ?? -1) + 1;

    const column = await db.rawQueryRow<TaskColumn>(
      `INSERT INTO task_columns (name, status_key, color, position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      req.name,
      req.status_key,
      req.color || "#6b7280",
      nextPosition
    );

    if (!column) throw new Error("Failed to create column");
    return column;
  }
);

export const updateColumn = api(
  { auth: true, expose: true, method: "PATCH", path: "/task-columns/:id" },
  async (params: UpdateColumnRequest): Promise<TaskColumn> => {
    const auth = getAuthData()!;
    if (!["WC", "CC"].includes(auth.role)) {
      throw APIError.permissionDenied("only Watch Commanders and Crew Commanders can manage columns");
    }

    const { id, ...updates } = params;
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      queryParams.push(updates.name);
    }
    if (updates.color !== undefined) {
      setClauses.push(`color = $${paramIndex++}`);
      queryParams.push(updates.color);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("no updates provided");
    }

    queryParams.push(id);
    const column = await db.rawQueryRow<TaskColumn>(
      `UPDATE task_columns SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      ...queryParams
    );

    if (!column) throw APIError.notFound("column not found");
    return column;
  }
);

export const deleteColumn = api<DeleteColumnRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/task-columns/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    if (!["WC", "CC"].includes(auth.role)) {
      throw APIError.permissionDenied("only Watch Commanders and Crew Commanders can manage columns");
    }

    // Check this isn't the last column
    const countRow = await db.rawQueryRow<{ count: number }>(
      `SELECT COUNT(*) as count FROM task_columns`
    );
    if ((countRow?.count ?? 0) <= 1) {
      throw APIError.failedPrecondition("cannot delete the last column");
    }

    // Reassign tasks in this column to the first remaining column
    const colRow = await db.rawQueryRow<{ status_key: string }>(
      `SELECT status_key FROM task_columns WHERE id = $1`, id
    );
    if (!colRow) throw APIError.notFound("column not found");

    const fallbackCol = await db.rawQueryRow<{ status_key: string }>(
      `SELECT status_key FROM task_columns WHERE id != $1 ORDER BY position ASC LIMIT 1`, id
    );
    if (fallbackCol) {
      await db.rawQueryAll(
        `UPDATE tasks SET status = $1 WHERE status = $2`,
        fallbackCol.status_key,
        colRow.status_key
      );
    }

    await db.rawQueryAll(`DELETE FROM task_columns WHERE id = $1`, id);
  }
);

export const reorderColumns = api<ReorderColumnsRequest, void>(
  { auth: true, expose: true, method: "POST", path: "/task-columns/reorder" },
  async (req) => {
    const auth = getAuthData()!;
    if (!["WC", "CC"].includes(auth.role)) {
      throw APIError.permissionDenied("only Watch Commanders and Crew Commanders can manage columns");
    }

    for (const col of req.columns) {
      await db.rawQueryAll(
        `UPDATE task_columns SET position = $1 WHERE id = $2`,
        col.position,
        col.id
      );
    }
  }
);
