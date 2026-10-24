import crypto from "crypto";
import db from "../db";

/**
 * A one-time link that lets the person choose their own password — used for
 * invites (new accounts) and admin-sent resets, so the admin never knows
 * anyone's password. Issuing a new link cancels any earlier one.
 */
export async function issueSetPasswordLink(
  userId: string,
  baseUrl: string | undefined,
  validForMs: number,
  invite: boolean
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + validForMs);
  await db.exec`
    UPDATE users
    SET password_reset_token = ${token},
        password_reset_expires = ${expires},
        updated_at = NOW()
    WHERE id = ${userId}
  `;
  const base = (baseUrl || "http://localhost:5173").trim().replace(/[./]+$/, "");
  return `${base}/reset-password?token=${token}${invite ? "&invite=1" : ""}`;
}
