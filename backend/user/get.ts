import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { User } from "./types";

interface GetUserRequest {
  id: string;
}

export const get = api<GetUserRequest, User>(
  { auth: true, expose: true, method: "GET", path: "/users/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    
    const userId = id === "me" ? auth.userID : id;
    
    const user = await db.queryRow<User>`
      SELECT * FROM users WHERE id = ${userId}
    `;

    if (!user) {
      throw APIError.notFound("user not found");
    }

    return user;
  }
);
