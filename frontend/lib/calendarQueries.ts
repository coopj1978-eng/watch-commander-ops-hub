import type { QueryClient } from "@tanstack/react-query";

/** The calendar page's events (one query since Nov 2026). Anything that adds,
 *  moves or removes a calendar entry calls this so the calendar catches up. */
export const CALENDAR_EVENTS_KEY = "cal-events";

/** The riding count on each shift (WC/CC) — bookings change it too. */
export const CALENDAR_STRENGTH_KEY = "cal-strength";

export function refreshCalendar(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [CALENDAR_EVENTS_KEY] });
  queryClient.invalidateQueries({ queryKey: [CALENDAR_STRENGTH_KEY] });
}
