import { api } from "encore.dev/api";
import db from "../db";
import type {
  OperationalInspection,
  CreateOperationalRequest,
  UpdateOperationalRequest,
  ListOperationalResponse,
} from "./types";

export const listOperational = api(
  { auth: true, expose: true, method: "GET", path: "/inspection-plans/operational" },
  async (): Promise<ListOperationalResponse> => {
    const rows = await db.rawQueryAll<OperationalInspection>(
      `SELECT * FROM operational_inspections ORDER BY position ASC, id ASC`
    );
    return { items: rows };
  }
);

export const createOperational = api(
  { auth: true, expose: true, method: "POST", path: "/inspection-plans/operational" },
  async (req: CreateOperationalRequest): Promise<OperationalInspection> => {
    const row = await db.rawQueryRow<OperationalInspection>(
      `INSERT INTO operational_inspections (address, uprn, watch, position)
       SELECT $1, $2, $3, COALESCE(MAX(position) + 1, 0) FROM operational_inspections
       RETURNING *`,
      req.address,
      req.uprn,
      req.watch ?? null
    );
    if (!row) throw new Error("Failed to create operational inspection");
    return row;
  }
);

export const updateOperational = api(
  { auth: true, expose: true, method: "PATCH", path: "/inspection-plans/operational/:id" },
  async (req: { id: number } & UpdateOperationalRequest): Promise<OperationalInspection> => {
    const { id, ...fields } = req;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.address !== undefined) { setClauses.push(`address = $${idx++}`); values.push(fields.address); }
    if (fields.uprn !== undefined) { setClauses.push(`uprn = $${idx++}`); values.push(fields.uprn); }
    if (fields.watch !== undefined) { setClauses.push(`watch = $${idx++}`); values.push(fields.watch); }
    if (fields.position !== undefined) { setClauses.push(`position = $${idx++}`); values.push(fields.position); }

    if (setClauses.length === 0) throw new Error("No fields to update");
    setClauses.push(`updated_at = now()`);
    values.push(id);

    const row = await db.rawQueryRow<OperationalInspection>(
      `UPDATE operational_inspections SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      ...values
    );
    if (!row) throw new Error("Operational inspection not found");
    return row;
  }
);

export const deleteOperational = api(
  { auth: true, expose: true, method: "DELETE", path: "/inspection-plans/operational/:id" },
  async (req: { id: number }): Promise<void> => {
    await db.exec`DELETE FROM operational_inspections WHERE id = ${req.id}`;
  }
);
