// What rings the bell (John, 25 Nov 2026: "we are getting too many alerts …
// important ones only", then "an alert toggle for the others in the setting
// section of each user, the others are permanent").
//
//   always rings — things that need YOU, or that change who can ride: a
//       crewing gap, someone booked sick or fit, a back-to-work interview,
//       an absence trigger, TOIL to approve, a flagged Flexi/H4H, a task
//       given to you, a bulletin or policy to read, a change someone made
//       to your calendar, your own certificates running out, and (WC) a
//       certificate on your watch that has expired. No switch for these.
//   extras       — off unless you turn them on in Settings:
//       watch_tasks  every overdue task on your watch (Home counts them);
//       certs_soon   WC/CC: a certificate on your watch within 30 days;
//       bookings     WC/CC: someone on your watch logs TOIL, an orange day,
//                    training, overtime or a flexi payback (it's on the
//                    calendar and in the riding count either way).
//   drops off    — anything older than 30 days.

/** The bell only shows this many days back. */
export const BELL_DAYS = 30;

/** A person's switches for the extra alerts. All off until they choose. */
export interface AlertPrefs {
  watch_tasks: boolean;
  certs_soon: boolean;
  bookings: boolean;
}
export const NO_EXTRAS: AlertPrefs = { watch_tasks: false, certs_soon: false, bookings: false };

/**
 * An overdue task always rings for the person it was given to; for the rest
 * of its watch only if they've switched "overdue watch tasks" on.
 */
export function overdueTaskRings(task: { assigned_to_user_id: string | null }, userId: string, prefs: AlertPrefs = NO_EXTRAS): boolean {
  if (task.assigned_to_user_id && task.assigned_to_user_id === userId) return true;
  return prefs.watch_tasks;
}

/**
 * A certificate always rings for its owner from 30 days out, and for their
 * Watch Commander once it has expired. A WC or CC who has switched
 * "expiring soon" on also hears from 30 days out.
 */
export function certRings(
  cert: { owner_id: string; days_left: number },
  viewer: { id: string; is_wc_of_owner: boolean; manages_owner?: boolean },
  prefs: AlertPrefs = NO_EXTRAS,
): boolean {
  if (cert.owner_id === viewer.id) return cert.days_left <= 30;
  if (viewer.is_wc_of_owner && cert.days_left < 0) return true;
  return prefs.certs_soon && (viewer.is_wc_of_owner || !!viewer.manages_owner) && cert.days_left <= 30;
}
