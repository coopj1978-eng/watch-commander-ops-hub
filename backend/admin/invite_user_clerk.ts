import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { hasPermission, Permission } from "../auth/rbac";
import { createClerkClient } from "@clerk/backend";
import { secret } from "encore.dev/config";
import db from "../db";

const clerkSecretKey = secret("ClerkSecretKey");
const clerkClient = createClerkClient({ secretKey: clerkSecretKey() });

interface InviteUserRequest {
  email: string;
}

interface InviteUserResponse {
  success: boolean;
  message: string;
}

export const inviteUserViaClerk = api<InviteUserRequest, InviteUserResponse>(
  { auth: true, expose: true, method: "POST", path: "/admin/invite-clerk" },
  async (req) => {
    const auth = getAuthData()!;
    
    if (!hasPermission(auth, Permission.MANAGE_USERS)) {
      throw APIError.permissionDenied("Only Watch Commanders can invite users");
    }

    const existingUser = await db.queryRow<{ id: string, is_active: boolean }>`
      SELECT id, is_active FROM users WHERE email = ${req.email}
    `;

    if (!existingUser) {
      throw APIError.notFound(`No user found with email ${req.email}. Please create their profile first.`);
    }

    if (existingUser.is_active) {
      throw APIError.alreadyExists(`User with email ${req.email} has already signed up.`);
    }

    try {
      await clerkClient.invitations.createInvitation({
        emailAddress: req.email,
        redirectUrl: process.env.NODE_ENV === 'production' 
          ? 'https://your-production-url.com/sign-up' 
          : undefined,
      });

      return {
        success: true,
        message: `Invitation sent to ${req.email}`,
      };
    } catch (error: any) {
      console.error("Failed to send Clerk invitation:", error);
      throw APIError.internal(`Failed to send invitation: ${error.message}`);
    }
  }
);
