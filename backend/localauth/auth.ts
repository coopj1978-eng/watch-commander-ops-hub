import { api, APIError, Cookie } from "encore.dev/api";
import { secret } from "encore.dev/config";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db";
import type { User } from "../user/types";

const jwtSecret = secret("JWTSecret");

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
    const existingUser = await db.queryRow<User>`
      SELECT * FROM users WHERE email = ${req.email}
    `;

    if (existingUser) {
      throw APIError.alreadyExists("User with this email already exists");
    }

    const passwordHash = await bcrypt.hash(req.password, 10);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newUser = await db.queryRow<User>`
      INSERT INTO users (id, email, name, password_hash, role, is_active)
      VALUES (
        ${userId},
        ${req.email},
        ${req.name},
        ${passwordHash},
        'FF',
        true
      )
      RETURNING *
    `;

    if (!newUser) {
      throw APIError.internal("Failed to create user");
    }

    await db.exec`
      INSERT INTO firefighter_profiles (
        user_id, rolling_sick_episodes, rolling_sick_days, 
        trigger_stage, driver_lgv, driver_erd
      )
      VALUES (
        ${userId}, 0, 0, 'None', false, false
      )
    `;

    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email, 
        role: newUser.role 
      },
      jwtSecret(),
      { expiresIn: "7d" }
    );

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
      token,
    };
  }
);

export const signIn = api<SignInRequest, AuthResponse>(
  { expose: true, method: "POST", path: "/auth/signin" },
  async (req) => {
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
      jwtSecret(),
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
  }
);

export const signOut = api<void, { success: boolean }>(
  { expose: true, method: "POST", path: "/auth/signout" },
  async () => {
    return { success: true };
  }
);
