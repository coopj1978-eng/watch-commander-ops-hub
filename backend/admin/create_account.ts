import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import * as bcrypt from "bcrypt";
import db from "../db";
import type { UserRole } from "../user/types";
import { createActivityLog } from "./create_activity_log";

export interface CreateAccountRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  watch_unit?: string;
  rank?: string;
}

export interface CreateAccountResponse {
  success: boolean;
  userId: string;
  email: string;
}

export const createAccount = api<CreateAccountRequest, CreateAccountResponse>(
  { method: "POST", path: "/admin/create-account", expose: true, auth: true },
  async (req) => {
    const auth = getAuthData()!;
    requireRole(auth, "WC");

    const existing = await db.queryRow<{ id: string }>`
      SELECT id FROM users WHERE email = ${req.email}
    `;
    if (existing) {
      throw APIError.alreadyExists("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(req.password, 10);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await db.exec`
      INSERT INTO users (id, email, name, password_hash, role, watch_unit, rank, is_active)
      VALUES (
        ${userId},
        ${req.email},
        ${req.name},
        ${passwordHash},
        ${req.role},
        ${req.watch_unit || null},
        ${req.rank || null},
        true
      )
    `;

    // Also create firefighter profile so they appear in staffing / people list
    try {
      await db.exec`
        INSERT INTO firefighter_profiles (
          user_id, watch, rolling_sick_episodes, rolling_sick_days,
          trigger_stage, driver_lgv, driver_erd
        )
        VALUES (
          ${userId},
          ${req.watch_unit || null},
          0, 0, 'None', false, false
        )
      `;
    } catch (err) {
      // Non-fatal — profile can be filled in later via the People page
      console.error("Failed to create firefighter profile:", err);
    }

    await createActivityLog({
      actor_user_id: auth.userID,
      action: "create_account",
      entity_type: "user",
      metadata: { email: req.email, role: req.role, watch_unit: req.watch_unit },
    });

    return { success: true, userId, email: req.email };
  }
);
