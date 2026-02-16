import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import type { UserRole } from "../user/types";
import { createActivityLog } from "./create_activity_log";

export interface InviteUserRequest {
  email: string;
  role: UserRole;
  name?: string;
}

export interface InviteUserResponse {
  success: boolean;
  userId?: string;
  invitationUrl?: string;
}

export const inviteUser = api(
  { method: "POST", path: "/api/admin/invite", expose: true, auth: true },
  async ({ email, role, name }: InviteUserRequest): Promise<InviteUserResponse> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC");

    const frontendUrl = process.env.FRONTEND_URL || "https://watch-commander-ops-hub-d4abnrc82vjoh2sfm460.lp.dev";
    const invitationUrl = `${frontendUrl}/sign-up?email=${encodeURIComponent(email)}`;

    await createActivityLog({
      actor_user_id: auth.userID,
      action: "invite_user",
      entity_type: "user",
      metadata: {
        email,
        role,
      },
    });

    return {
      success: true,
      invitationUrl,
    };
  }
);
