import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import db from "../db";
import type { User } from "../user/types";

export const listUsers = api(
  { method: "GET", path: "/api/admin/users", expose: true, auth: true },
  async (): Promise<{ users: User[] }> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC");

    const query = `
      SELECT 
        id, email, name, role, watch_unit, rank, avatar_url,
        last_login_at, is_active, left_at, created_at, updated_at
      FROM users
      ORDER BY is_active DESC, name ASC
    `;

    const rows = await db.rawQueryAll<User>(query);

    return { users: rows };
  }
);
