import db from "../db";
import type { AuthData } from "./auth";

export async function logSignIn(authData: AuthData): Promise<void> {
  try {
    await db.exec`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
      VALUES (
        ${authData.userID},
        'sign_in',
        'auth',
        ${authData.userID},
        ${JSON.stringify({
          email: authData.email,
          role: authData.role,
          watch_unit: authData.watchUnit,
          timestamp: new Date().toISOString(),
        })}
      )
    `;
  } catch (error) {
    console.error("Failed to log sign-in:", error);
  }
}
