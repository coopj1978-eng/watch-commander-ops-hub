import { api, APIError } from "encore.dev/api";
import * as bcrypt from "bcrypt";
import db from "../db";
import jwt from "jsonwebtoken";
import { rateLimit, resetRateLimit, getRequestIp, RESET_PASSWORD_LIMIT } from "./rate_limit";
import { getJwtSecret } from "./auth";
import { logSignIn } from "../auth/login_logger";
import type { User } from "../user/types";

interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

interface ResetPasswordResponse {
  success: boolean;
  /**
   * A session for the person who has just set their password, so the page
   * can take them straight into the app (Nov 2026). Before this an invite
   * ended at "Your account is ready" and a sign-in page asking for the email
   * and the same password again — the moment a new firefighter gives up.
   * Whoever holds the link could already set the password and sign in with
   * it, so this hands over nothing new.
   */
  token?: string;
  user?: { id: string; email: string; name: string; role: string };
}

export const resetPassword = api<ResetPasswordRequest, ResetPasswordResponse>(
  { expose: true, method: "POST", path: "/auth/reset-password" },
  async (req) => {
    // Rate limit by token (stops brute-forcing the 64-char reset token) and
    // by IP (stops a single attacker churning through generated tokens).
    rateLimit(`reset:token:${req.token}`, RESET_PASSWORD_LIMIT);
    rateLimit(`reset:ip:${getRequestIp()}`, RESET_PASSWORD_LIMIT);

    if (req.new_password.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }

    const user = await db.queryRow<{ id: string; email: string; password_reset_expires: Date | null }>`
      SELECT id, email, password_reset_expires
      FROM users
      WHERE password_reset_token = ${req.token}
        AND password_reset_token IS NOT NULL
    `;

    if (!user) {
      throw APIError.notFound("This reset link is invalid or has already been used.");
    }

    if (!user.password_reset_expires || new Date() > new Date(user.password_reset_expires)) {
      // Clean up the expired token
      await db.exec`
        UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ${user.id}
      `;
      throw APIError.failedPrecondition("This reset link has expired. Please request a new one.");
    }

    const passwordHash = await bcrypt.hash(req.new_password, 10);

    await db.exec`
      UPDATE users
      SET password_hash = ${passwordHash},
          is_active = true,
          password_changed_at = NOW(),
          password_reset_token = NULL,
          password_reset_expires = NULL,
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // They've just proved they own the account, so lift any sign-in
    // lockout left over from guessing the old password.
    resetRateLimit(`signin:email:${user.email.trim().toLowerCase()}`);
    resetRateLimit(`signin:ip:${getRequestIp()}`);

    // Sign them in. If anything about that fails the password is still set:
    // the page falls back to "now sign in".
    try {
      const fresh = await db.queryRow<User>`SELECT * FROM users WHERE id = ${user.id}`;
      if (fresh && fresh.is_active) {
        const token = jwt.sign({ userId: fresh.id, email: fresh.email, role: fresh.role }, getJwtSecret(), { expiresIn: "7d" });
        await logSignIn(fresh);
        return { success: true, token, user: { id: fresh.id, email: fresh.email, name: fresh.name, role: fresh.role } };
      }
    } catch (err) {
      console.error("reset-password: password set, but signing in failed:", err);
    }

    return { success: true };
  }
);
