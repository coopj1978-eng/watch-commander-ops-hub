import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export const fixMyRole = api<void, { success: boolean; message: string }>(
  { expose: true, auth: true, method: "POST", path: "/admin/fix-my-role" },
  async () => {
    const auth = getAuthData()!;

    await db.exec`
      UPDATE users SET role = 'WC' WHERE id = ${auth.userID}
    `;

    return {
      success: true,
      message: "Role updated to WC in database. Please sign out and back in.",
    };
  }
);
