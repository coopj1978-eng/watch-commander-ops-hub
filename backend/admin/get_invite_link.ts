import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { hasPermission, Permission } from "../auth/rbac";
import db from "../db";

interface GetInviteLinkRequest {
  email: string;
}

interface GetInviteLinkResponse {
  invite_link: string;
  user_name: string;
  user_email: string;
}

export const getInviteLink = api<GetInviteLinkRequest, GetInviteLinkResponse>(
  { auth: true, expose: true, method: "POST", path: "/admin/get-invite-link" },
  async (req) => {
    const auth = getAuthData()!;
    
    if (!hasPermission(auth, Permission.MANAGE_ALL_USERS)) {
      throw APIError.permissionDenied("Only Watch Commanders can generate invite links");
    }

    const existingUser = await db.queryRow<{ id: string, name: string, email: string, is_active: boolean }>`
      SELECT id, name, email, is_active FROM users WHERE email = ${req.email}
    `;

    if (!existingUser) {
      throw APIError.notFound(`No user found with email ${req.email}. Please create their profile first.`);
    }

    if (existingUser.is_active) {
      throw APIError.alreadyExists(`User with email ${req.email} has already signed up.`);
    }

    const inviteLink = `${process.env.FRONTEND_URL || 'https://watch-commander-ops-hub-d4abnrc82vjoh2sfm460.lp.dev'}/sign-up?email=${encodeURIComponent(req.email)}`;

    return {
      invite_link: inviteLink,
      user_name: existingUser.name,
      user_email: existingUser.email,
    };
  }
);
