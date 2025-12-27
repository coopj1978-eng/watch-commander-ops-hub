import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";
import { logActivity } from "../logging/logger";

interface DeleteDictionaryRequest {
  id: number;
}

export const deleteDictionary = api<DeleteDictionaryRequest, { success: boolean }>(
  { auth: true, method: "DELETE", path: "/dictionary/:id", expose: true },
  async ({ id }) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.EDIT_ALL_PROFILES);

    await db.exec`
      DELETE FROM dictionaries WHERE id = ${id}
    `;

    await logActivity({
      user_id: auth.userID,
      action: "delete_dictionary",
      entity_type: "dictionary",
      entity_id: id.toString(),
      details: {},
    });

    return { success: true };
  }
);
