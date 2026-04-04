import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { hasPermission, Permission } from "../auth/rbac";
import db from "../db";

interface GetInviteLinkRequest {
  email: string;
  frontend_url?: string; // caller passes window.location.origin
}

interface GetInviteLinkResponse {
  invite_link: string;
  user_name: string;
  user_email: string;
  already_active: boolean;
}

export const getInviteLink = api<GetInviteLinkRequest, GetInviteLinkResponse>(
  { auth: true, expose: true, method: "POST", path: "/admin/get-invite-link" },
  async (req) => {
    const auth = getAuthData()!;

    if (!hasPermission(auth, Permission.MANAGE_ALL_USERS)) {
      throw APIError.permissionDenied("Only Watch Commanders can generate invite links");
    }

    const existingUser = await db.queryRow<{ id: string, name: string, email: string, password_hash: string | null, is_active: boolean }>`
      SELECT id, name, email, password_hash, is_active FROM users WHERE LOWER(email) = LOWER(${req.email})
    `;

    if (!existingUser) {
      throw APIError.notFound(`No user found with email ${req.email}. Please create their profile first.`);
    }

    // Already has a password set — they've registered, just need to sign in
    const alreadyActive = !!existingUser.password_hash;

    const baseUrl = req.frontend_url || "http://localhost:5173";
    const inviteLink = `${baseUrl}/sign-up?email=${encodeURIComponent(req.email)}`;

    return {
      invite_link: inviteLink,
      user_name: existingUser.name,
      user_email: existingUser.email,
      already_active: alreadyActive,
    };
  }
);
