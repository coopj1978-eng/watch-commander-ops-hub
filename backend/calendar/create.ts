import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateEventRequest, CalendarEvent } from "./types";

export const create = api<CreateEventRequest, CalendarEvent>(
  { auth: true, expose: true, method: "POST", path: "/calendar/events" },
  async (req) => {
    const auth = getAuthData()!;
    const event = await db.queryRow<CalendarEvent>`
      INSERT INTO calendar_events (
        title, description, event_type, calendar_visibility, start_time, end_time, all_day,
        user_id, is_watch_event, location, attendees, color, created_by
      )
      VALUES (
        ${req.title}, ${req.description}, ${req.event_type},
        ${req.calendar_visibility || 'station'}, ${req.start_time},
        ${req.end_time}, ${req.all_day || false}, ${req.user_id},
        ${req.is_watch_event || false}, ${req.location}, ${req.attendees},
        ${req.color}, ${req.created_by}
      )
      RETURNING *
    `;

    if (!event) {
      throw new Error("Failed to create calendar event");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_calendar_event",
      entity_type: "calendar_event",
      entity_id: event.id.toString(),
      details: { title: event.title, start_time: event.start_time },
    });

    return event;
  }
);
