import { api, APIError } from "encore.dev/api";
import * as bcrypt from "bcrypt";
import db from "../db";

interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

interface ResetPasswordResponse {
  success: boolean;
}

export const resetPassword = api<ResetPasswordRequest, ResetPasswordResponse>(
  { expose: true, method: "POST", path: "/auth/reset-password" },
  async (req) => {
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
          password_reset_token = NULL,
          password_reset_expires = NULL,
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    return { success: true };
  }
);
