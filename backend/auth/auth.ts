import { createClerkClient, verifyToken } from "@clerk/backend";
import { Header, Cookie, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";
import { logSignIn } from "./login_logger";
import { adminEmail } from "./secrets";
import db from "../db";
import type { User } from "../user/types";

const clerkSecretKey = secret("ClerkSecretKey");
const clerkClient = createClerkClient({ secretKey: clerkSecretKey() });

interface AuthParams {
  authorization?: Header<"Authorization">;
  session?: Cookie<"session">;
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
  const token =
    data.authorization?.replace("Bearer ", "") ?? data.session?.value;
  if (!token) {
    throw APIError.unauthenticated("missing token");
  }

  try {
    const verifiedToken = await verifyToken(token, {
      secretKey: clerkSecretKey(),
    });

    const clerkUser = await clerkClient.users.getUser(verifiedToken.sub);
    const metadata = clerkUser.publicMetadata || {};
    const userEmail = clerkUser.emailAddresses[0]?.emailAddress ?? null;
    
    let dbUser = await db.queryRow<User>`
      SELECT * FROM users WHERE id = ${clerkUser.id}
    `;

    if (!dbUser) {
      const userName = clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.username || clerkUser.emailAddresses[0]?.emailAddress || "User";
      
      const defaultRole: UserRole = "FF";
      
      const existingPendingUser = await db.queryRow<User>`
        SELECT * FROM users WHERE email = ${userEmail} AND is_active = false
      `;
      
      if (existingPendingUser) {
        await db.exec`
          UPDATE users 
          SET id = ${clerkUser.id}, 
              name = ${userName},
              avatar_url = ${clerkUser.imageUrl},
              is_active = true,
              updated_at = NOW()
          WHERE id = ${existingPendingUser.id}
        `;
        
        await db.exec`
          UPDATE firefighter_profiles
          SET user_id = ${clerkUser.id}
          WHERE user_id = ${existingPendingUser.id}
        `;
        
        dbUser = await db.queryRow<User>`
          SELECT * FROM users WHERE id = ${clerkUser.id}
        `;
        
        if (!dbUser) {
          throw APIError.internal("Failed to link user account");
        }
      } else {
        dbUser = await db.queryRow<User>`
          INSERT INTO users (id, email, name, role, avatar_url, is_active)
          VALUES (
            ${clerkUser.id},
            ${userEmail || `user-${clerkUser.id}@temp.local`},
            ${userName},
            ${defaultRole},
            ${clerkUser.imageUrl},
            ${true}
          )
          RETURNING *
        `;

        if (!dbUser) {
          throw APIError.internal("Failed to create user in database");
        }
        
        await db.exec`
          INSERT INTO firefighter_profiles (
            user_id, rolling_sick_episodes, rolling_sick_days, 
            trigger_stage, driver_lgv, driver_erd
          )
          VALUES (
            ${clerkUser.id}, 0, 0, 'None', false, false
          )
        `;
      }
    }

    if (!dbUser.is_active) {
      throw APIError.permissionDenied("Account is inactive. Please contact your administrator.");
    }

    let role = (metadata.role as UserRole) || dbUser.role || "FF";

    const existingWC = await db.queryRow<User>`
      SELECT * FROM users WHERE role = 'WC' LIMIT 1
    `;

    if (!existingWC) {
      role = "WC";
      await db.exec`
        UPDATE users SET role = 'WC' WHERE id = ${clerkUser.id}
      `;
      await clerkClient.users.updateUserMetadata(clerkUser.id, {
        publicMetadata: { ...metadata, role: "WC" },
      });
    } else if (userEmail === adminEmail()) {
      role = "WC";
      if (dbUser.role !== "WC") {
        await db.exec`
          UPDATE users SET role = 'WC' WHERE id = ${clerkUser.id}
        `;
        await clerkClient.users.updateUserMetadata(clerkUser.id, {
          publicMetadata: { ...metadata, role: "WC" },
        });
      }
    }
    
    const authData: AuthData = {
      userID: clerkUser.id,
      imageUrl: clerkUser.imageUrl,
      email: userEmail,
      role,
      watchUnit: metadata.watch_unit as string | undefined,
      rank: metadata.rank as string | undefined,
      assignedCrews: metadata.assigned_crews as string[] | undefined,
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

export const gw = new Gateway({ authHandler: auth });
