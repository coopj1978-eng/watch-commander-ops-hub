import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import { createClerkClient } from "@clerk/backend";
import { secret } from "encore.dev/config";
import type { UserRole } from "../user/types";
import { createActivityLog } from "./create_activity_log";

const clerkSecretKey = secret("ClerkSecretKey");
const clerkClient = createClerkClient({ secretKey: clerkSecretKey() });

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

    try {
      const invitation = await clerkClient.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: {
          role,
          invited_by: auth.userID,
        },
        redirectUrl: process.env.FRONTEND_URL || "https://watch-commander-ops-hub-d4abnrc82vjoh2sfm460.lp.dev",
      });

      await createActivityLog({
        actor_user_id: auth.userID,
        action: "invite_user",
        entity_type: "user",
        metadata: {
          email,
          role,
          invitation_id: invitation.id,
        },
      });

      return {
        success: true,
        invitationUrl: invitation.url,
      };
    } catch (error) {
      console.error("Failed to create invitation:", error);
      throw APIError.internal("Failed to send invitation");
    }
  }
);
