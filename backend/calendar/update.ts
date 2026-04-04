import { api, APIError } from "encore.dev/api";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateEventRequest, CalendarEvent } from "./types";
import { getWatchOnShift, getWatchOnShiftForDate } from "../lib/shiftRota";

interface UpdateEventParams {
  id: number;
  user_id: string;
  updates: UpdateEventRequest;
}

export const update = api<UpdateEventParams, CalendarEvent>(
  { expose: true, method: "PATCH", path: "/calendar/events/:id" },
  async ({ id, user_id, updates }) => {
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

    // If the time changed, re-assign the linked station_event task to the correct watch
    if (updates.start_time !== undefined) {
      const linkedTask = await db.rawQueryRow<{ id: number; all_day: boolean }>(
        `SELECT t.id, ce.all_day FROM tasks t
         JOIN calendar_events ce ON ce.id = t.calendar_event_id
         WHERE t.calendar_event_id = $1 AND t.source_type = 'station_event' AND t.status != 'Done'`,
        id
      );
      if (linkedTask) {
        const newStart = new Date(updates.start_time);
        const newWatch = linkedTask.all_day
          ? getWatchOnShiftForDate(newStart)
          : getWatchOnShift(newStart);
        if (newWatch) {
          await db.rawQueryRow(
            `UPDATE tasks SET due_at = $1, watch_unit = $2, updated_at = NOW() WHERE id = $3`,
            newStart, newWatch, linkedTask.id
          );
        }
      }
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
