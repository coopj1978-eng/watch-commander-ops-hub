import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { setupToken } from "../auth/secrets";
import { createClerkClient } from "@clerk/backend";
import { secret } from "encore.dev/config";
import db from "../db";
import type { User } from "../user/types";
import { APIError } from "encore.dev/api";
import { logActivity } from "../logging/logger";

const clerkSecretKey = secret("ClerkSecretKey");
const clerkClient = createClerkClient({ secretKey: clerkSecretKey() });

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

    const clerkUser = await clerkClient.users.getUser(auth.userID);
    const metadata = clerkUser.publicMetadata || {};
    await clerkClient.users.updateUserMetadata(auth.userID, {
      publicMetadata: { ...metadata, role: "WC" },
    });

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
