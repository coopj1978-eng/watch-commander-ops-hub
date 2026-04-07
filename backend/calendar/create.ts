import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateEventRequest, CalendarEvent } from "./types";
import { getWatchOnShift, getWatchOnShiftForDate } from "../lib/shiftRota";

// Map calendar event_type → task category
const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  inspection:  "Inspection",
  training:    "Training",
  meeting:     "Admin",
  maintenance: "Other",
  watch:       "Admin",
  reminder:    "Admin",
  personal:    "Other",
};

// Event source types that come from shift adjustments — never auto-create tasks for these
const SHIFT_ADJUSTMENT_SOURCES = new Set(["shift_adjustment"]);

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

    if (!event) throw new Error("Failed to create calendar event");

    // ── Auto-create a watch task for station/watch events ──────────────────────
    // Conditions: station or watch visibility, not from a shift adjustment, not personal
    const visibility = req.calendar_visibility ?? "station";
    const isSharedEvent = visibility === "station" || visibility === "watch";
    const isShiftAdjustment = req.source_type && SHIFT_ADJUSTMENT_SOURCES.has(req.source_type);
    const isPersonalEvent = visibility === "personal";

    if (isSharedEvent && !isShiftAdjustment && !isPersonalEvent) {
      const startTime = new Date(req.start_time);

      // Determine which watch is on duty
      const targetWatch = req.all_day
        ? getWatchOnShiftForDate(startTime)
        : getWatchOnShift(startTime);

      if (targetWatch) {
        const category = EVENT_TYPE_TO_CATEGORY[req.event_type] ?? "Other";

        await db.rawQueryRow(
          `INSERT INTO tasks (title, description, category, assigned_by, priority, due_at, watch_unit, source_type, calendar_event_id, status)
           VALUES ($1, $2, $3, $4, 'Med', $5, $6, 'station_event', $7, 'NotStarted')`,
          req.title,
          req.description ?? null,
          category,
          auth.userID,
          startTime,
          targetWatch,
          event.id,
        );
      }
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
