import { api } from "encore.dev/api";
import { createClerkClient } from "@clerk/backend";
import { secret } from "encore.dev/config";
import db from "../db";

const clerkSecretKey = secret("ClerkSecretKey");
const clerkClient = createClerkClient({ secretKey: clerkSecretKey() });

export const fixMyRole = api<void, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/admin/fix-my-role" },
  async () => {
    const userId = "user_35TU012AT2UzloJxYMnuLeQvoSX";
    
    await db.exec`
      UPDATE users SET role = 'WC' WHERE id = ${userId}
    `;
    
    try {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: { role: "WC" },
      });
      
      return {
        success: true,
        message: "Role updated to WC in both database and Clerk. Please sign out and back in.",
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Database updated but Clerk update failed: ${error.message}. Try signing out and back in.`,
      };
    }
  }
);
