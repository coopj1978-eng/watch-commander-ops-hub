import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import * as bcrypt from "bcrypt";
import db from "../db";

const setupToken = secret("SetupToken");

interface CreateAdminRequest {
  email: string;
  password: string;
  name: string;
  setup_token: string;
}

export const createAdmin = api<CreateAdminRequest, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/auth/create-admin" },
  async (req) => {
    if (req.setup_token !== setupToken()) {
      throw new Error("Invalid setup token");
    }

    const existingUser = await db.queryRow<{ id: string }>`
      SELECT id FROM users WHERE email = ${req.email}
    `;

    if (existingUser) {
      const passwordHash = await bcrypt.hash(req.password, 10);
      
      await db.exec`
        UPDATE users 
        SET password_hash = ${passwordHash},
            name = ${req.name},
            role = 'WC',
            is_active = true
        WHERE email = ${req.email}
      `;

      return {
        success: true,
        message: `Admin account updated for ${req.email}`,
      };
    } else {
      const passwordHash = await bcrypt.hash(req.password, 10);
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      await db.exec`
        INSERT INTO users (id, email, name, password_hash, role, is_active)
        VALUES (
          ${userId},
          ${req.email},
          ${req.name},
          ${passwordHash},
          'WC',
          true
        )
      `;

      await db.exec`
        INSERT INTO firefighter_profiles (
          user_id, rolling_sick_episodes, rolling_sick_days, 
          trigger_stage, driver_lgv, driver_erd
        )
        VALUES (
          ${userId}, 0, 0, 'None', false, false
        )
      `;

      return {
        success: true,
        message: `Admin account created for ${req.email}`,
      };
    }
  }
);
