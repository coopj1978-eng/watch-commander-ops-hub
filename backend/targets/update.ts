import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateTargetRequest, Target } from "./types";

interface UpdateTargetParams {
  id: number;
}

export const update = api(
  { auth: true, expose: true, method: "PATCH", path: "/targets/:id" },
  async (params: UpdateTargetParams & UpdateTargetRequest): Promise<Target> => {
    const { id, ...updates } = params;
    const auth = getAuthData()!;
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.period_start !== undefined) {
      setClauses.push(`period_start = $${paramIndex++}`);
      queryParams.push(updates.period_start);
    }
    if (updates.period_end !== undefined) {
      setClauses.push(`period_end = $${paramIndex++}`);
      queryParams.push(updates.period_end);
    }
    if (updates.metric !== undefined) {
      setClauses.push(`metric = $${paramIndex++}`);
      queryParams.push(updates.metric);
    }
    if (updates.target_count !== undefined) {
      setClauses.push(`target_count = $${paramIndex++}`);
      queryParams.push(updates.target_count);
    }
    if (updates.actual_count !== undefined) {
      setClauses.push(`actual_count = $${paramIndex++}`);
      queryParams.push(updates.actual_count);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      queryParams.push(updates.notes);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      queryParams.push(updates.status);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("no updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    queryParams.push(id);

    const query = `
      UPDATE targets
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const target = await db.rawQueryRow<Target>(query, ...queryParams);

    if (!target) {
      throw APIError.notFound("target not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_target",
      entity_type: "target",
      entity_id: target.id.toString(),
      details: updates,
    });

    return target;
  }
);
