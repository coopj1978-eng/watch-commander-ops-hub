import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requireAdmin } from "../auth/admin";
import { logActivity } from "../logging/logger";
import { toPublicUser, type CreateUserRequest, type User } from "./types";

export const create = api<CreateUserRequest, User>(
  { auth: true, expose: true, method: "POST", path: "/users" },
  async (req) => {
    const auth = getAuthData()!;

    // Only Watch Commanders can create user accounts
    requireAdmin(auth);
    
    const existingUser = await db.queryRow<User>`
      SELECT * FROM users WHERE LOWER(email) = LOWER(${req.email})
    `;

    if (existingUser) {
      return toPublicUser(existingUser);
    }

    const user = await db.queryRow<User>`
      INSERT INTO users (id, email, name, role, watch_unit, rank, avatar_url, is_active)
      VALUES (
        ${req.id}, 
        ${req.email}, 
        ${req.name}, 
        ${req.role},
        ${req.watch_unit || null},
        ${req.rank || null},
        ${req.avatar_url || null},
        ${req.is_active !== undefined ? req.is_active : true}
      )
      RETURNING *
    `;

    if (!user) {
      throw new Error("Failed to create user");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_user",
      entity_type: "user",
      entity_id: user.id,
      details: { email: user.email, role: user.role },
    });

    return toPublicUser(user);
  }
);
