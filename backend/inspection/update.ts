import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateInspectionRequest, Inspection } from "./types";

interface UpdateInspectionParams {
  id: number;
}

export const update = api(
  { auth: true, expose: true, method: "PATCH", path: "/inspections/:id" },
  async (params: UpdateInspectionParams & UpdateInspectionRequest): Promise<Inspection> => {
    const { id, ...updates } = params;
    const auth = getAuthData()!;
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.type !== undefined) {
      setClauses.push(`type = $${paramIndex++}`);
      queryParams.push(updates.type);
    }
    if (updates.address !== undefined) {
      setClauses.push(`address = $${paramIndex++}`);
      queryParams.push(updates.address);
    }
    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex++}`);
      queryParams.push(updates.priority);
    }
    if (updates.scheduled_for !== undefined) {
      setClauses.push(`scheduled_for = $${paramIndex++}`);
      queryParams.push(updates.scheduled_for);
    }
    if (updates.assigned_crew_ids !== undefined) {
      setClauses.push(`assigned_crew_ids = $${paramIndex++}`);
      queryParams.push(updates.assigned_crew_ids);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      queryParams.push(updates.status);
      if (updates.status === "Complete") {
        setClauses.push(`completed_date = NOW()`);
      }
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      queryParams.push(updates.notes);
    }
    if (updates.completed_date !== undefined) {
      setClauses.push(`completed_date = $${paramIndex++}`);
      queryParams.push(updates.completed_date);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("no updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    queryParams.push(id);

    const query = `
      UPDATE inspections
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const inspection = await db.rawQueryRow<Inspection>(query, ...queryParams);

    if (!inspection) {
      throw APIError.notFound("inspection not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_inspection",
      entity_type: "inspection",
      entity_id: id.toString(),
      details: updates,
    });

    return inspection;
  }
);
