import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { requirePermission, Permission } from "../auth/rbac";

interface DeleteUserRequest {
  id: string;
}

export const deleteUser = api<DeleteUserRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/users/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.MANAGE_ALL_USERS);

    const result = await db.exec`DELETE FROM users WHERE id = ${id}`;

    await logActivity({
      user_id: auth.userID,
      action: "delete_user",
      entity_type: "user",
      entity_id: id,
      details: {},
    });
  }
);
