import { api, Query, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { setupToken } from "../auth/secrets";
import db from "../db";
import type { User } from "../user/types";
import { logActivity } from "../logging/logger";

export interface BootstrapRequest {
  setupToken: Query<string>;
}

export interface BootstrapResponse {
  success: boolean;
  message: string;
  newRole: string;
}

export const bootstrap = api<BootstrapRequest, BootstrapResponse>(
  { auth: true, expose: true, method: "POST", path: "/admin/bootstrap" },
  async (req) => {
    const auth = getAuthData()!;

    if (req.setupToken !== setupToken()) {
      throw APIError.permissionDenied("Invalid setup token");
    }

    const existingWC = await db.queryRow<User>`
      SELECT * FROM users WHERE role = 'WC' LIMIT 1
    `;

    if (existingWC) {
      throw APIError.alreadyExists("A Watch Commander already exists in the system");
    }

    await db.exec`
      UPDATE users SET role = 'WC' WHERE id = ${auth.userID}
    `;

    await logActivity({
      user_id: auth.userID,
      action: "bootstrap_watch_commander",
      entity_type: "user",
      entity_id: auth.userID,
      details: { previous_role: auth.role, new_role: "WC" },
    });

    return {
      success: true,
      message: "You have been promoted to Watch Commander",
      newRole: "WC",
    };
  }
);
