import { api, APIError } from "encore.dev/api";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateEventRequest, CalendarEvent } from "./types";
import { assertCanModifyEvent } from "./permissions";
import { eventWatch, notifyIfOtherWatch, taskWatchFor, ukDay } from "./watchEvents";

interface UpdateEventParams {
  id: number;
  /** Ignored — the caller is taken from the auth token. */
  user_id?: string;
  updates: UpdateEventRequest;
}

export const update = api<UpdateEventParams, CalendarEvent>(
  { auth: true, expose: true, method: "PATCH", path: "/calendar/events/:id" },
  async ({ id, updates }) => {
    const user_id = await assertCanModifyEvent(id);
    const before = await db.queryRow<{ start_time: Date; title: string }>`
      SELECT start_time, title FROM calendar_events WHERE id = ${id}
    `;
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }
    if (updates.event_type !== undefined) {
      setClauses.push(`event_type = $${paramIndex++}`);
      params.push(updates.event_type);
    }
    if (updates.start_time !== undefined) {
      setClauses.push(`start_time = $${paramIndex++}`);
      params.push(updates.start_time);
    }
    if (updates.end_time !== undefined) {
      setClauses.push(`end_time = $${paramIndex++}`);
      params.push(updates.end_time);
    }
    if (updates.all_day !== undefined) {
      setClauses.push(`all_day = $${paramIndex++}`);
      params.push(updates.all_day);
    }
    if (updates.location !== undefined) {
      setClauses.push(`location = $${paramIndex++}`);
      params.push(updates.location);
    }
    if (updates.attendees !== undefined) {
      setClauses.push(`attendees = $${paramIndex++}`);
      params.push(updates.attendees);
    }
    if (updates.color !== undefined) {
      setClauses.push(`color = $${paramIndex++}`);
      params.push(updates.color);
    }
    if (updates.calendar_visibility !== undefined) {
      setClauses.push(`calendar_visibility = $${paramIndex++}`);
      params.push(updates.calendar_visibility);
      // Also update is_watch_event to match
      setClauses.push(`is_watch_event = $${paramIndex++}`);
      params.push(updates.calendar_visibility === "station" || updates.calendar_visibility === "watch");
    }

    // A reschedule keeps where it was first due, who moved it and why —
    // the note shows on the event, like a note on the paper calendar.
    const moved =
      updates.start_time !== undefined &&
      !!before &&
      new Date(updates.start_time).getTime() !== new Date(before.start_time).getTime();
    if (moved) {
      setClauses.push(`rescheduled_from = COALESCE(rescheduled_from, $${paramIndex++})`);
      params.push(before!.start_time);
    }
    if (moved || updates.change_note !== undefined) {
      setClauses.push(`change_note = $${paramIndex++}`);
      params.push(updates.change_note?.trim() || null);
      setClauses.push(`changed_by = $${paramIndex++}`);
      params.push(user_id);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("no updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE calendar_events
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const event = await db.rawQueryRow<CalendarEvent>(query, ...params);

    if (!event) {
      throw APIError.notFound("calendar event not found");
    }

    // The linked board card follows the event only when it's actually moved
    // (a watch-calendar event's card stays with that watch). The form sends
    // the start time on every save, so checking for it alone meant adding a
    // note to the event undid a card someone had moved to another day or watch.
    if (moved) {
      const linkedTask = await db.rawQueryRow<{ id: number }>(
        `SELECT t.id FROM tasks t
         WHERE t.calendar_event_id = $1 AND t.source_type = 'station_event' AND t.status != 'Done'`,
        id
      );
      if (linkedTask) {
        const newStart = new Date(updates.start_time!); // set — `moved` checks it
        const newWatch = taskWatchFor(event);
        if (newWatch) {
          await db.rawQueryRow(
            `UPDATE tasks SET due_at = $1, watch_unit = $2, updated_at = NOW() WHERE id = $3`,
            newStart, newWatch, linkedTask.id
          );
        }
      }
    }

    // A renamed event renames its open card, so the calendar and board agree.
    if (updates.title !== undefined && updates.title.trim() && before && updates.title !== before.title) {
      await db.rawExec(
        `UPDATE tasks SET title = $1, updated_at = NOW()
         WHERE calendar_event_id = $2 AND source_type = 'station_event' AND status <> 'Done'`,
        updates.title.trim(), id
      );
    }

    if (moved) {
      const note = updates.change_note?.trim();
      await notifyIfOtherWatch(await eventWatch(id), id, "Your watch calendar was changed",
        (by) => `${by} moved "${event.title}" from ${ukDay(before!.start_time)} to ${ukDay(event.start_time)}${note ? ` — ${note}` : ""}.`);
    }

    await logActivity({
      user_id: user_id,
      action: "update_calendar_event",
      entity_type: "calendar_event",
      entity_id: id.toString(),
      details: updates,
    });

    return event;
  }
);
