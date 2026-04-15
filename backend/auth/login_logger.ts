import db from "../db";
import type { AuthData } from "./auth";

export async function logSignIn(authData: AuthData): Promise<void> {
  try {
    // Pass the raw object — Encore's driver serialises JS objects to jsonb
    // directly. Using JSON.stringify produced a jsonb *string* value (the
    // payload got re-quoted), which broke -> / ->> / @> queries.
    await db.exec`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
      VALUES (
        ${authData.userID},
        'sign_in',
        'auth',
        ${authData.userID},
        ${{
          email: authData.email,
          role: authData.role,
          watch_unit: authData.watchUnit,
          timestamp: new Date().toISOString(),
        }}
      )
    `;
  } catch (error) {
    console.error("Failed to log sign-in:", error);
  }
}
