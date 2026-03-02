import { api } from "encore.dev/api";
import db from "../db";
import type {
  MultistoryInspection,
  CreateMultistoryRequest,
  UpdateMultistoryRequest,
  ListMultistoryResponse,
} from "./types";

export const listMultistory = api(
  { auth: true, expose: true, method: "GET", path: "/inspection-plans/multistory" },
  async (): Promise<ListMultistoryResponse> => {
    const rows = await db.rawQueryAll<MultistoryInspection>(
      `SELECT * FROM multistory_inspections ORDER BY position ASC, id ASC`
    );
    return { items: rows };
  }
);

export const createMultistory = api(
  { auth: true, expose: true, method: "POST", path: "/inspection-plans/multistory" },
  async (req: CreateMultistoryRequest): Promise<MultistoryInspection> => {
    const row = await db.rawQueryRow<MultistoryInspection>(
      `INSERT INTO multistory_inspections (address, q1_watch, q2_watch, q3_watch, q4_watch, position)
       SELECT $1, $2, $3, $4, $5, COALESCE(MAX(position) + 1, 0) FROM multistory_inspections
       RETURNING *`,
      req.address,
      req.q1_watch ?? null,
      req.q2_watch ?? null,
      req.q3_watch ?? null,
      req.q4_watch ?? null
    );
    if (!row) throw new Error("Failed to create multi-story inspection");
    return row;
  }
);

export const updateMultistory = api(
  { auth: true, expose: true, method: "PATCH", path: "/inspection-plans/multistory/:id" },
  async (req: { id: number } & UpdateMultistoryRequest): Promise<MultistoryInspection> => {
    const { id, ...fields } = req;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.address !== undefined) { setClauses.push(`address = $${idx++}`); values.push(fields.address); }
    if (fields.q1_watch !== undefined) { setClauses.push(`q1_watch = $${idx++}`); values.push(fields.q1_watch); }
    if (fields.q2_watch !== undefined) { setClauses.push(`q2_watch = $${idx++}`); values.push(fields.q2_watch); }
    if (fields.q3_watch !== undefined) { setClauses.push(`q3_watch = $${idx++}`); values.push(fields.q3_watch); }
    if (fields.q4_watch !== undefined) { setClauses.push(`q4_watch = $${idx++}`); values.push(fields.q4_watch); }
    if (fields.position !== undefined) { setClauses.push(`position = $${idx++}`); values.push(fields.position); }

    if (setClauses.length === 0) throw new Error("No fields to update");
    setClauses.push(`updated_at = now()`);
    values.push(id);

    const row = await db.rawQueryRow<MultistoryInspection>(
      `UPDATE multistory_inspections SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      ...values
    );
    if (!row) throw new Error("Multi-story inspection not found");
    return row;
  }
);

export const deleteMultistory = api(
  { auth: true, expose: true, method: "DELETE", path: "/inspection-plans/multistory/:id" },
  async (req: { id: number }): Promise<void> => {
    await db.exec`DELETE FROM multistory_inspections WHERE id = ${req.id}`;
  }
);
