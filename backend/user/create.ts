import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateUserRequest, User } from "./types";

export const create = api<CreateUserRequest, User>(
  { auth: true, expose: true, method: "POST", path: "/users" },
  async (req) => {
    const auth = getAuthData()!;
    
    const existingUser = await db.queryRow<User>`
      SELECT * FROM users WHERE email = ${req.email}
    `;

    if (existingUser) {
      return existingUser;
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

    return user;
  }
);
