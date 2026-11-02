import type { QueryClient } from "@tanstack/react-query";

/** The calendar page's events (one query since Nov 2026). Anything that adds,
 *  moves or removes a calendar entry calls this so the calendar catches up. */
export const CALENDAR_EVENTS_KEY = "cal-events";

export function refreshCalendar(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [CALENDAR_EVENTS_KEY] });
}
