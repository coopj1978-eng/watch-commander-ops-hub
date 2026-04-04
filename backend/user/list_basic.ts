import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { User } from "./types";

interface ListBasicUsersResponse {
  users: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

export const listBasic = api<void, ListBasicUsersResponse>(
  { auth: true, expose: true, method: "GET", path: "/users/basic" },
  async () => {
    const auth = getAuthData()!;

    const query = `
      SELECT id, name, email 
      FROM users 
      WHERE left_at IS NULL
      ORDER BY name ASC
    `;
    
    const users = await db.rawQueryAll<Pick<User, "id" | "name" | "email">>(query);

    return {
      users,
    };
  }
);
