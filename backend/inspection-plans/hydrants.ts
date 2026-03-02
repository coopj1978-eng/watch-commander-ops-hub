import { api } from "encore.dev/api";
import db from "../db";
import type {
  HydrantRegister,
  CreateHydrantRequest,
  UpdateHydrantRequest,
  ListHydrantResponse,
} from "./types";

export const listHydrants = api(
  { auth: true, expose: true, method: "GET", path: "/inspection-plans/hydrants" },
  async (): Promise<ListHydrantResponse> => {
    const rows = await db.rawQueryAll<HydrantRegister>(
      `SELECT * FROM hydrant_registers ORDER BY position ASC, id ASC`
    );
    return { items: rows };
  }
);

export const createHydrant = api(
  { auth: true, expose: true, method: "POST", path: "/inspection-plans/hydrants" },
  async (req: CreateHydrantRequest): Promise<HydrantRegister> => {
    const row = await db.rawQueryRow<HydrantRegister>(
      `INSERT INTO hydrant_registers (area_code, street, section, year, watch, position)
       SELECT $1, $2, $3, $4, $5, COALESCE(MAX(position) + 1, 0) FROM hydrant_registers
       RETURNING *`,
      req.area_code,
      req.street,
      req.section,
      req.year,
      req.watch ?? null
    );
    if (!row) throw new Error("Failed to create hydrant register entry");
    return row;
  }
);

export const updateHydrant = api(
  { auth: true, expose: true, method: "PATCH", path: "/inspection-plans/hydrants/:id" },
  async (req: { id: number } & UpdateHydrantRequest): Promise<HydrantRegister> => {
    const { id, ...fields } = req;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.area_code !== undefined) { setClauses.push(`area_code = $${idx++}`); values.push(fields.area_code); }
    if (fields.street !== undefined) { setClauses.push(`street = $${idx++}`); values.push(fields.street); }
    if (fields.section !== undefined) { setClauses.push(`section = $${idx++}`); values.push(fields.section); }
    if (fields.year !== undefined) { setClauses.push(`year = $${idx++}`); values.push(fields.year); }
    if (fields.watch !== undefined) { setClauses.push(`watch = $${idx++}`); values.push(fields.watch); }
    if (fields.position !== undefined) { setClauses.push(`position = $${idx++}`); values.push(fields.position); }

    if (setClauses.length === 0) throw new Error("No fields to update");
    setClauses.push(`updated_at = now()`);
    values.push(id);

    const row = await db.rawQueryRow<HydrantRegister>(
      `UPDATE hydrant_registers SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      ...values
    );
    if (!row) throw new Error("Hydrant register entry not found");
    return row;
  }
);

export const deleteHydrant = api(
  { auth: true, expose: true, method: "DELETE", path: "/inspection-plans/hydrants/:id" },
  async (req: { id: number }): Promise<void> => {
    await db.exec`DELETE FROM hydrant_registers WHERE id = ${req.id}`;
  }
);
