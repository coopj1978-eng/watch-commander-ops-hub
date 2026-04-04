import { Header, Cookie, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";
import jwt from "jsonwebtoken";
import { logSignIn } from "./login_logger";
import { adminEmail } from "./secrets";
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

interface AuthParams {
  authorization?: Header<"Authorization">;
  auth_token?: Cookie<"auth_token">;
}

export type UserRole = "WC" | "CC" | "FF" | "RO";

export interface AuthData {
  userID: string;
  imageUrl: string;
  email: string | null;
  role: UserRole;
  watchUnit?: string;
  rank?: string;
  assignedCrews?: string[];
}

export const auth = authHandler<AuthParams, AuthData>(async (data) => {
  const token = data.authorization?.replace("Bearer ", "");
  if (!token) {
    throw APIError.unauthenticated("missing token");
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      userId: string;
      email: string;
      role: string;
    };

    let dbUser = await db.queryRow<User>`
      SELECT * FROM users WHERE id = ${decoded.userId}
    `;

    if (!dbUser) {
      throw APIError.unauthenticated("user not found");
    }

    if (!dbUser.is_active) {
      throw APIError.permissionDenied("Account is inactive. Please contact your administrator.");
    }

    let role = dbUser.role as UserRole;

    const existingWC = await db.queryRow<User>`
      SELECT * FROM users WHERE role = 'WC' LIMIT 1
    `;

    if (!existingWC) {
      role = "WC";
      await db.exec`
        UPDATE users SET role = 'WC' WHERE id = ${dbUser.id}
      `;
    } else if (dbUser.email === adminEmail()) {
      role = "WC";
      if (dbUser.role !== "WC") {
        await db.exec`
          UPDATE users SET role = 'WC' WHERE id = ${dbUser.id}
        `;
      }
    }

    const authData: AuthData = {
      userID: dbUser.id,
      imageUrl: dbUser.avatar_url || "",
      email: dbUser.email,
      role,
      watchUnit: dbUser.watch_unit || "",
      rank: dbUser.rank || "",
    };

    await logSignIn(authData);

    return authData;
  } catch (err) {
    console.error("Authentication error:", {
      error: err,
      message: err instanceof Error ? err.message : "Unknown error",
      tokenPreview: token?.substring(0, 20) + "...",
    });
    if (err instanceof APIError) {
      throw err;
    }
    throw APIError.unauthenticated("invalid token", err as Error);
  }
});

export const gw = new Gateway({
  authHandler: auth,
  cors: {
    allowOriginsWithCredentials: [
      "https://watch-commander-ops-hub-frontend.vercel.app",
      "https://*.vercel.app",
      "http://localhost:5173",
      "http://localhost:4000",
    ],
    allowHeaders: ["Authorization", "Content-Type"],
    exposeHeaders: ["Authorization"],
  },
});
