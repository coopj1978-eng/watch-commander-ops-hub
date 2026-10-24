import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { toPublicUser, type UpdateUserRequest, type User } from "./types";

interface UpdateUserParams {
  id: string;
  updates: UpdateUserRequest;
}

export const update = api<UpdateUserParams, User>(
  { auth: true, expose: true, method: "PATCH", path: "/users/:id" },
  async ({ id, updates }) => {
    const auth = getAuthData()!;
    const isWC = auth.role === "WC";
    const isSelf = auth.userID === id;

    // Role or email changes enable account takeover, so they're admin-only,
    // and nobody can change their own role (avoids locking everyone out).
    if ((updates.role !== undefined || updates.email !== undefined) && !auth.isAdmin) {
      throw APIError.permissionDenied("Only the admin can change someone's role or email");
    }
    if (updates.role !== undefined && isSelf) {
      throw APIError.permissionDenied("You can't change your own role");
    }
    if (!isSelf && !isWC && auth.role !== "CC") {
      throw APIError.permissionDenied("You can only update your own account");
    }

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

    return toPublicUser(user);
  }
);
