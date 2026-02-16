import { api } from "encore.dev/api";
import db from "../db";

export const fixMyRole = api<void, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/admin/fix-my-role" },
  async () => {
    const userId = "user_35TU012AT2UzloJxYMnuLeQvoSX";

    await db.exec`
      UPDATE users SET role = 'WC' WHERE id = ${userId}
    `;

    return {
      success: true,
      message: "Role updated to WC in database. Please sign out and back in.",
    };
  }
);
