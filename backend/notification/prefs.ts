// Your own switches for the extra bell alerts (John, 25 Nov 2026). The
// important alerts have no switch — see lib/bellRules.ts.

import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { NO_EXTRAS, type AlertPrefs } from "../lib/bellRules";

/** A person's switches; everything extra is off until they've chosen. */
export async function alertPrefsOf(userId: string): Promise<AlertPrefs> {
  const row = await db.rawQueryRow<AlertPrefs>(
    `SELECT watch_tasks, certs_soon, bookings FROM user_alert_prefs WHERE user_id = $1`, userId,
  );
  return row ? { watch_tasks: !!row.watch_tasks, certs_soon: !!row.certs_soon, bookings: !!row.bookings } : { ...NO_EXTRAS };
}

export interface AlertPrefsResponse {
  watch_tasks: boolean;
  certs_soon: boolean;
  bookings: boolean;
}

export const getAlertPrefs = api<void, AlertPrefsResponse>(
  { auth: true, expose: true, method: "GET", path: "/notifications/prefs" },
  async () => alertPrefsOf(getAuthData()!.userID),
);

interface SetAlertPrefsRequest {
  watch_tasks?: boolean;
  certs_soon?: boolean;
  bookings?: boolean;
}

export const setAlertPrefs = api<SetAlertPrefsRequest, AlertPrefsResponse>(
  { auth: true, expose: true, method: "POST", path: "/notifications/prefs" },
  async (req) => {
    const userId = getAuthData()!.userID;
    const now = await alertPrefsOf(userId);
    const next: AlertPrefs = {
      watch_tasks: req.watch_tasks ?? now.watch_tasks,
      certs_soon: req.certs_soon ?? now.certs_soon,
      bookings: req.bookings ?? now.bookings,
    };
    await db.rawExec(
      `INSERT INTO user_alert_prefs (user_id, watch_tasks, certs_soon, bookings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET watch_tasks = EXCLUDED.watch_tasks, certs_soon = EXCLUDED.certs_soon,
             bookings = EXCLUDED.bookings, updated_at = NOW()`,
      userId, next.watch_tasks, next.certs_soon, next.bookings,
    );
    return next;
  },
);
