import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { User, UserRole } from "./types";
import { requirePermission, Permission } from "../auth/rbac";

interface ListUsersRequest {
  role?: Query<UserRole>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListUsersResponse {
  users: User[];
  total: number;
}

export const list = api<ListUsersRequest, ListUsersResponse>(
  { auth: true, expose: true, method: "GET", path: "/users" },
  async (req) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.VIEW_ALL_PROFILES);

    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM users`;
    let countQuery = `SELECT COUNT(*) as count FROM users`;
    const params: any[] = [];
    let paramIndex = 1;

    if (req.role) {
      query += ` WHERE role = $${paramIndex}`;
      countQuery += ` WHERE role = $${paramIndex}`;
      params.push(req.role);
      paramIndex++;
    }

    query += ` ORDER BY name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const users = await db.rawQueryAll<User>(query, ...params);
    const countResult = await db.rawQueryRow<{ count: number }>(
      countQuery,
      ...(req.role ? [req.role] : [])
    );

    return {
      users,
      total: countResult?.count || 0,
    };
  }
);
