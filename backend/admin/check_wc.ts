import { api } from "encore.dev/api";
import db from "../db";
import type { User } from "../user/types";

export interface CheckWCResponse {
  hasWC: boolean;
}

export const checkWC = api<void, CheckWCResponse>(
  { expose: true, method: "GET", path: "/admin/check-wc" },
  async () => {
    const existingWC = await db.queryRow<User>`
      SELECT * FROM users WHERE role = 'WC' LIMIT 1
    `;

    return {
      hasWC: !!existingWC,
    };
  }
);
