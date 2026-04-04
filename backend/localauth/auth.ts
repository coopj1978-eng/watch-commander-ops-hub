import { api, APIError, Cookie } from "encore.dev/api";
import { secret } from "encore.dev/config";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db";
import type { User } from "../user/types";

const jwtSecretRef = secret("JWTSecret");

function getJwtSecret(): string {
  try {
    const val = jwtSecretRef();
    if (val) return val;
  } catch {
    // Secret not configured
  }
  throw new Error("JWTSecret is not configured. Run: encore secret set --type local JWTSecret");
}

interface SignUpRequest {
  email: string;
  password: string;
  name: string;
}

interface SignInRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  token: string;
}

export const signUp = api<SignUpRequest, AuthResponse>(
  { expose: true, method: "POST", path: "/auth/signup" },
  async (req) => {
    try {
      const existingUser = await db.queryRow<User>`
        SELECT * FROM users WHERE LOWER(email) = LOWER(${req.email})
      `;

      // ── Invited user activating their pre-created account ─────────────────
      // WC created their profile via "Create Person" — no password set yet.
      // Allow them to set a password and activate the account.
      if (existingUser && !existingUser.password_hash) {
        const passwordHash = await bcrypt.hash(req.password, 10);
        const activated = await db.queryRow<User>`
          UPDATE users
          SET password_hash = ${passwordHash},
              is_active = true,
              name = COALESCE(NULLIF(${req.name.trim()}, ''), name),
              updated_at = NOW()
          WHERE id = ${existingUser.id}
          RETURNING *
        `;
        if (!activated) throw APIError.internal("Failed to activate account");

        const token = jwt.sign(
          { userId: activated.id, email: activated.email, role: activated.role },
          getJwtSecret(),
          { expiresIn: "7d" }
        );
        return {
          user: { id: activated.id, email: activated.email, name: activated.name, role: activated.role },
          token,
        };
      }

      // ── Already fully registered ───────────────────────────────────────────
      if (existingUser) {
        throw APIError.alreadyExists("An account with this email already exists. Please sign in instead.");
      }

      // ── Brand new self-registration ────────────────────────────────────────
      const passwordHash = await bcrypt.hash(req.password, 10);
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Check if any WC exists — first-ever user becomes WC + active.
      const existingWC = await db.queryRow<{ id: string }>`
        SELECT id FROM users WHERE role = 'WC' AND is_active = true LIMIT 1
      `;
      const isFirstUser = !existingWC;

      const newUser = await db.queryRow<User>`
        INSERT INTO users (id, email, name, password_hash, role, is_active)
        VALUES (
          ${userId},
          ${req.email},
          ${req.name},
          ${passwordHash},
          ${isFirstUser ? 'WC' : 'FF'},
          ${isFirstUser}
        )
        RETURNING *
      `;

      if (!newUser) throw APIError.internal("Failed to create user");

      try {
        await db.exec`
          INSERT INTO firefighter_profiles (
            user_id, rolling_sick_episodes, rolling_sick_days,
            trigger_stage, driver_lgv, driver_erd
          )
          VALUES (${userId}, 0, 0, 'None', false, false)
        `;
      } catch (profileErr) {
        console.error("Failed to create firefighter profile (non-fatal):", profileErr);
      }

      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email, role: newUser.role },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

      return {
        user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
        token,
      };
    } catch (err) {
      if (err instanceof APIError) throw err;
      console.error("SignUp unexpected error:", err);
      throw APIError.internal(`Sign up failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
);

export const signIn = api<SignInRequest, AuthResponse>(
  { expose: true, method: "POST", path: "/auth/signin" },
  async (req) => {
    try {
      const user = await db.queryRow<User>`
        SELECT * FROM users WHERE email = ${req.email}
      `;

      if (!user || !user.password_hash) {
        throw APIError.unauthenticated("Invalid email or password");
      }

      if (!user.is_active) {
        throw APIError.permissionDenied("Account is inactive. Please contact your administrator.");
      }

      const isValidPassword = await bcrypt.compare(req.password, user.password_hash);

      if (!isValidPassword) {
        throw APIError.unauthenticated("Invalid email or password");
      }

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role
        },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      };
    } catch (err) {
      if (err instanceof APIError) throw err;
      console.error("SignIn unexpected error:", err);
      throw APIError.internal(`Sign in failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
);

export const signOut = api<void, { success: boolean }>(
  { expose: true, method: "POST", path: "/auth/signout" },
  async () => {
    return { success: true };
  }
);
