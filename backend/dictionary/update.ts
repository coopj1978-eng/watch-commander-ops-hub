import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";
import type { Dictionary, UpdateDictionaryRequest } from "./types";

interface UpdateDictionaryParams {
  id: number;
}

interface DBDictionary {
  id: number;
  type: string;
  value: string;
  active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export const update = api(
  { auth: true, method: "PATCH", path: "/dictionary/:id", expose: true },
  async (params: UpdateDictionaryParams & UpdateDictionaryRequest): Promise<Dictionary> => {
    const { id, ...updates } = params;
    const auth = getAuthData()!;
    requirePermission(auth, Permission.EDIT_ALL_PROFILES);

    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.value !== undefined) {
      setClauses.push(`value = $${paramIndex++}`);
      queryParams.push(updates.value);
    }

    if (updates.active !== undefined) {
      setClauses.push(`active = $${paramIndex++}`);
      queryParams.push(updates.active);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("no updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    queryParams.push(id);

    const query = `
      UPDATE dictionaries
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const dbItem = await db.rawQueryRow<DBDictionary>(query, ...queryParams);

    if (!dbItem) {
      throw APIError.notFound("dictionary entry not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_dictionary",
      entity_type: "dictionary",
      entity_id: id.toString(),
      details: updates,
    });

    return {
      id: dbItem.id,
      type: dbItem.type as any,
      value: dbItem.value,
      active: dbItem.active,
      created_at: dbItem.created_at,
    };
  }
);
