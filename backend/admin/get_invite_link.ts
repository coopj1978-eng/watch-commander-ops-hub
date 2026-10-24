import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireAdmin } from "../auth/admin";
import db from "../db";
import { issueSetPasswordLink } from "../lib/passwordLinks";

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

const INVITE_VALID_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// The admin sends this to someone they've added so they can choose their
// own password. One-time code, 14 days; a newer invite or reset replaces it.
export const getInviteLink = api<GetInviteLinkRequest, GetInviteLinkResponse>(
  { auth: true, expose: true, method: "POST", path: "/admin/get-invite-link" },
  async (req) => {
    requireAdmin(getAuthData()!);

    const existingUser = await db.queryRow<{ id: string; name: string; email: string; password_hash: string | null }>`
      SELECT id, name, email, password_hash FROM users WHERE LOWER(email) = LOWER(${req.email})
    `;
    if (!existingUser) {
      throw APIError.notFound(`No user found with email ${req.email}. Please create their profile first.`);
    }

    // Already has a password — they've signed up; send a reset link instead.
    if (existingUser.password_hash) {
      return { invite_link: "", user_name: existingUser.name, user_email: existingUser.email, already_active: true };
    }

    const inviteLink = await issueSetPasswordLink(existingUser.id, req.frontend_url, INVITE_VALID_MS, true);
    return {
      invite_link: inviteLink,
      user_name: existingUser.name,
      user_email: existingUser.email,
      already_active: false,
    };
  }
);

interface PasswordResetLinkRequest {
  user_id: string;
  frontend_url?: string;
}

interface PasswordResetLinkResponse {
  reset_link: string;
  user_name: string;
}

const RESET_VALID_MS = 24 * 60 * 60 * 1000; // 24 hours

// For someone who has forgotten their password: the admin sends them a
// one-time link (e.g. on WhatsApp) and they choose a new password. The admin
// never sees or sets it, and their old logins stop working once it's changed.
export const getPasswordResetLink = api<PasswordResetLinkRequest, PasswordResetLinkResponse>(
  { auth: true, expose: true, method: "POST", path: "/admin/password-reset-link" },
  async (req) => {
    requireAdmin(getAuthData()!);

    const user = await db.queryRow<{ id: string; name: string; password_hash: string | null; left_at: Date | null }>`
      SELECT id, name, password_hash, left_at FROM users WHERE id = ${req.user_id}
    `;
    if (!user || user.left_at) throw APIError.notFound("User not found");
    if (!user.password_hash) {
      throw APIError.failedPrecondition("They haven't set up their account yet — send them an invite link instead.");
    }

    const link = await issueSetPasswordLink(user.id, req.frontend_url, RESET_VALID_MS, false);
    return { reset_link: link, user_name: user.name };
  }
);
