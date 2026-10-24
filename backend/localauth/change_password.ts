import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db";
import { getJwtSecret } from "./auth";
import type { User } from "../user/types";
import { rateLimit, resetRateLimit, CHANGE_PASSWORD_LIMIT } from "./rate_limit";

// ── Change own password (logged-in user) ──────────────────────────────────────
interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

interface ChangePasswordResponse {
  success: boolean;
  /** A fresh login for this device — logins on other devices stop working. */
  token: string;
}

export const changePassword = api<ChangePasswordRequest, ChangePasswordResponse>(
  { expose: true, method: "POST", path: "/auth/change-password", auth: true },
  async (req) => {
    const auth = getAuthData()!;

    // Rate limit by user — defends a stolen session against current_password brute-force.
    const limitKey = `change-password:user:${auth.userID}`;
    rateLimit(limitKey, CHANGE_PASSWORD_LIMIT);

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

    if (req.new_password === req.current_password) {
      throw APIError.invalidArgument("Choose a different password from your current one");
    }

    const newHash = await bcrypt.hash(req.new_password, 10);
    await db.exec`
      UPDATE users
      SET password_hash = ${newHash}, password_changed_at = NOW(), updated_at = NOW()
      WHERE id = ${auth.userID}
    `;

    // Successful change — clear counter so the user isn't penalised for typos.
    resetRateLimit(limitKey);

    // Logins issued before the change stop working (other devices are signed
    // out); this device gets a fresh one.
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: "7d" }
    );
    return { success: true, token };
  }
);
