// What rings the bell (John, 25 Nov 2026: "we are getting too many alerts …
// important ones only"). His bell had 42 unread: 34 left over from the
// spring, and most of the rest were one alert for every overdue task on the
// watch. The rule now: the bell is for things that need YOU, or that change
// who can ride. Everything else is already on Home ("Needs you"), the
// calendar and the riding count.
//
//   rings      — a crewing gap, someone booked sick or fit, a back-to-work
//                interview, an absence trigger, TOIL to approve, a flagged
//                Flexi/H4H, a task given to you, a bulletin or policy to
//                read, a change someone made to your calendar, and your own
//                certificates running out.
//   doesn't    — a watch task going overdue that isn't yours (Home counts
//                them), someone else's certificate that hasn't expired yet
//                (Home counts those too), and "X logged a TOIL / orange day /
//                training / overtime" (it's on the calendar).
//   drops off  — anything older than 30 days.

/** The bell only shows this many days back. */
export const BELL_DAYS = 30;

/** An overdue task rings only for the person it was given to. */
export function overdueTaskRings(task: { assigned_to_user_id: string | null }, userId: string): boolean {
  return !!task.assigned_to_user_id && task.assigned_to_user_id === userId;
}

/**
 * A certificate rings for its owner from 30 days out; for their Watch
 * Commander only once it has actually expired.
 */
export function certRings(cert: { owner_id: string; days_left: number }, viewer: { id: string; is_wc_of_owner: boolean }): boolean {
  if (cert.owner_id === viewer.id) return cert.days_left <= 30;
  return viewer.is_wc_of_owner && cert.days_left < 0;
}

/**
 * Does logging this kind of booking tell the Watch Commander? None do now:
 * the booking is on the calendar and in the riding count. (Flexi and H4H
 * raise their own alert when one is flagged — over the limit, short notice.)
 */
export function bookingLoggedRings(_type: string): boolean {
  return false;
}
