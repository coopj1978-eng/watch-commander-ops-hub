import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateUserRequest, User } from "./types";

interface UpdateUserParams {
  id: string;
  updates: UpdateUserRequest;
}

export const update = api<UpdateUserParams, User>(
  { auth: true, expose: true, method: "PATCH", path: "/users/:id" },
  async ({ id, updates }) => {
    const auth = getAuthData()!;
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      params.push(updates.email);
    }
    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.role !== undefined) {
      setClauses.push(`role = $${paramIndex++}`);
      params.push(updates.role);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("no updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const user = await db.rawQueryRow<User>(query, ...params);

    if (!user) {
      throw APIError.notFound("user not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_user",
      entity_type: "user",
      entity_id: id,
      details: updates,
    });

    return user;
  }
);
