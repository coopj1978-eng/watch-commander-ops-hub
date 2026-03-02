import { api } from "encore.dev/api";
import db from "../db";
import type {
  CareHomeValidation,
  CreateCareHomeRequest,
  UpdateCareHomeRequest,
  ListCareHomeResponse,
} from "./types";

export const listCareHomes = api(
  { auth: true, expose: true, method: "GET", path: "/inspection-plans/care-homes" },
  async (): Promise<ListCareHomeResponse> => {
    const rows = await db.rawQueryAll<CareHomeValidation>(
      `SELECT * FROM care_home_validations ORDER BY position ASC, id ASC`
    );
    return { items: rows };
  }
);

export const createCareHome = api(
  { auth: true, expose: true, method: "POST", path: "/inspection-plans/care-homes" },
  async (req: CreateCareHomeRequest): Promise<CareHomeValidation> => {
    const row = await db.rawQueryRow<CareHomeValidation>(
      `INSERT INTO care_home_validations (address, position)
       SELECT $1, COALESCE(MAX(position) + 1, 0) FROM care_home_validations
       RETURNING *`,
      req.address
    );
    if (!row) throw new Error("Failed to create care home validation");
    return row;
  }
);

export const updateCareHome = api(
  { auth: true, expose: true, method: "PATCH", path: "/inspection-plans/care-homes/:id" },
  async (req: { id: number } & UpdateCareHomeRequest): Promise<CareHomeValidation> => {
    const { id, ...fields } = req;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.address !== undefined) { setClauses.push(`address = $${idx++}`); values.push(fields.address); }
    if (fields.position !== undefined) { setClauses.push(`position = $${idx++}`); values.push(fields.position); }

    if (setClauses.length === 0) throw new Error("No fields to update");
    setClauses.push(`updated_at = now()`);
    values.push(id);

    const row = await db.rawQueryRow<CareHomeValidation>(
      `UPDATE care_home_validations SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      ...values
    );
    if (!row) throw new Error("Care home validation not found");
    return row;
  }
);

export const deleteCareHome = api(
  { auth: true, expose: true, method: "DELETE", path: "/inspection-plans/care-homes/:id" },
  async (req: { id: number }): Promise<void> => {
    await db.rawQueryRow(
      `DELETE FROM care_home_validations WHERE id = $1`,
      req.id
    );
  }
);
