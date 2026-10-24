import { getAuthData } from "~encore/auth";
import db from "../db";
import { notifyWatchManagers } from "../notification/helpers";
import { getWatchOnShift, getWatchOnShiftForDate } from "../lib/shiftRota";

// Any WC/CC can add to, strike through or reschedule another watch's
// calendar (things change while that watch is off shift). When they do,
// that watch's own WC/CC are told.

/** "Sat 24 Oct" in UK time, for notification text. */
export function ukDay(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London",
  });
}

export function isManager(): boolean {
  const auth = getAuthData()!;
  return auth.role === "WC" || auth.role === "CC";
}

export async function callerWatch(): Promise<string | null> {
  const auth = getAuthData()!;
  const row = await db.queryRow<{ watch: string | null }>`
    SELECT COALESCE(u.watch_unit, fp.watch) AS watch
    FROM users u LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
    WHERE u.id = ${auth.userID}
  `;
  return row?.watch || null;
}

/** The watch a watch-calendar event belongs to (legacy rows: its creator's). */
export async function eventWatch(eventId: number): Promise<string | null> {
  const row = await db.queryRow<{ watch: string | null }>`
    SELECT CASE WHEN ce.calendar_visibility = 'watch'
                THEN COALESCE(ce.watch, creator.watch_unit) END AS watch
    FROM calendar_events ce
    LEFT JOIN users creator ON creator.id = ce.created_by
    WHERE ce.id = ${eventId}
  `;
  return row?.watch || null;
}

/** Tell a watch's WC/CC when someone from another watch changes their calendar. */
export async function notifyIfOtherWatch(
  watch: string | null,
  eventId: number,
  title: string,
  describe: (actorName: string) => string
): Promise<void> {
  if (!watch) return;
  const mine = await callerWatch();
  if (mine && mine.toLowerCase() === watch.toLowerCase()) return;
  const auth = getAuthData()!;
  const actor = await db.queryRow<{ name: string }>`SELECT name FROM users WHERE id = ${auth.userID}`;
  await notifyWatchManagers(watch, [auth.userID], {
    type: "general",
    title,
    message: describe(actor?.name ?? "A WC/CC"),
    entity_type: "calendar_event",
    entity_id: String(eventId),
    link: "/calendar",
  });
}

const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  inspection:  "Inspection",
  training:    "Training",
  meeting:     "Admin",
  maintenance: "Other",
  watch:       "Admin",
  reminder:    "Admin",
  personal:    "Other",
};

/**
 * Station/watch events get a task for the watch on duty at that time.
 * Used on create and when a struck-through event is reinstated.
 */
export async function createLinkedTask(event: {
  id: number;
  title: string;
  description?: string | null;
  event_type: string;
  start_time: Date;
  all_day: boolean;
}, assignedBy: string): Promise<void> {
  const startTime = new Date(event.start_time);
  const targetWatch = event.all_day ? getWatchOnShiftForDate(startTime) : getWatchOnShift(startTime);
  if (!targetWatch) return;
  await db.rawQueryRow(
    `INSERT INTO tasks (title, description, category, assigned_by, priority, due_at, watch_unit, source_type, calendar_event_id, status)
     VALUES ($1, $2, $3, $4, 'Med', $5, $6, 'station_event', $7, 'NotStarted')`,
    event.title,
    event.description ?? null,
    EVENT_TYPE_TO_CATEGORY[event.event_type] ?? "Other",
    assignedBy,
    startTime,
    targetWatch,
    event.id
  );
}

/** A struck-through event's task comes off the board (finished ones stay). */
export async function removeOpenLinkedTasks(eventId: number): Promise<void> {
  await db.exec`
    DELETE FROM tasks
    WHERE calendar_event_id = ${eventId} AND source_type = 'station_event' AND status <> 'Done'
  `;
}
