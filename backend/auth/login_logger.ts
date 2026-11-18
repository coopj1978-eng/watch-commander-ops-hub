import db from "../db";

interface SignedInUser {
  id: string;
  email: string;
  role: string;
  watch_unit?: string | null;
}

/**
 * Records one real sign-in: a `sign_in` row in the activity log and the
 * "Last login" time on the user. Call it where a login is actually issued
 * (the sign-in endpoint) — never from the auth handler, which runs on every
 * request and used to fill the log with a row per API call.
 *
 * Never throws: a logging failure must not stop someone signing in.
 */
export async function logSignIn(user: SignedInUser): Promise<void> {
  try {
    // Pass the raw object — Encore's driver serialises JS objects to jsonb
    // directly. Using JSON.stringify produced a jsonb *string* value (the
    // payload got re-quoted), which broke -> / ->> / @> queries.
    await db.exec`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
      VALUES (
        ${user.id},
        'sign_in',
        'auth',
        ${user.id},
        ${{
          email: user.email,
          role: user.role,
          watch_unit: user.watch_unit || "",
          timestamp: new Date().toISOString(),
        }}
      )
    `;
  } catch (error) {
    console.error("Failed to log sign-in:", error);
  }

  try {
    await db.exec`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`;
  } catch (error) {
    console.error("Failed to record last login time:", error);
  }
}
