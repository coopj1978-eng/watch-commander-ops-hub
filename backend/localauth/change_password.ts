import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import * as bcrypt from "bcrypt";
import db from "../db";
import type { User } from "../user/types";

// ── Change own password (logged-in user) ──────────────────────────────────────
interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

interface ChangePasswordResponse {
  success: boolean;
}

export const changePassword = api<ChangePasswordRequest, ChangePasswordResponse>(
  { expose: true, method: "POST", path: "/auth/change-password", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    if (req.new_password.length < 8) {
      throw APIError.invalidArgument("New password must be at least 8 characters");
    }

    const user = await db.queryRow<User>`
      SELECT * FROM users WHERE id = ${auth.userID}
    `;

    if (!user || !user.password_hash) {
      throw APIError.unauthenticated("User not found");
    }

    const isValid = await bcrypt.compare(req.current_password, user.password_hash);
    if (!isValid) {
      throw APIError.unauthenticated("Current password is incorrect");
    }

    const newHash = await bcrypt.hash(req.new_password, 10);
    await db.exec`
      UPDATE users SET password_hash = ${newHash}, updated_at = NOW()
      WHERE id = ${auth.userID}
    `;

    return { success: true };
  }
);

// ── WC resets another user's password ────────────────────────────────────────
interface ResetUserPasswordRequest {
  userId: string;
  new_password: string;
}

interface ResetUserPasswordResponse {
  success: boolean;
}

export const resetUserPassword = api<ResetUserPasswordRequest, ResetUserPasswordResponse>(
  { expose: true, method: "POST", path: "/auth/reset-user-password", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    if (auth.role !== "WC") {
      throw APIError.permissionDenied("Only Watch Commanders can reset passwords");
    }

    if (req.new_password.length < 8) {
      throw APIError.invalidArgument("Password must be at least 8 characters");
    }

    const user = await db.queryRow<{ id: string }>`
      SELECT id FROM users WHERE id = ${req.userId}
    `;

    if (!user) {
      throw APIError.notFound("User not found");
    }

    const newHash = await bcrypt.hash(req.new_password, 10);
    await db.exec`
      UPDATE users
      SET password_hash = ${newHash}, is_active = true, updated_at = NOW()
      WHERE id = ${req.userId}
    `;

    return { success: true };
  }
);
