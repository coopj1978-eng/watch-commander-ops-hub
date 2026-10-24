import { api, APIError } from "encore.dev/api";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CalendarEvent } from "./types";
import { assertCanModifyEvent } from "./permissions";
import {
  createLinkedTask,
  eventWatch,
  notifyIfOtherWatch,
  removeOpenLinkedTasks,
  ukDay,
} from "./watchEvents";

// Striking an event through — the app's version of putting a line through
// it on the paper calendar and writing why. It stays on the calendar
// (crossed out, with the reason) instead of being deleted, and can be
// reinstated. Bookings (TOIL / H4H / Flexi…) are changed through their own
// booking form instead.

interface CancelEventRequest {
  id: number;
  reason: string;
}

async function loadForChange(id: number) {
  const ev = await db.queryRow<{ shift_adjustment_id: number | null }>`
    SELECT shift_adjustment_id FROM calendar_events WHERE id = ${id}
  `;
  if (!ev) throw APIError.notFound("Event not found");
  if (ev.shift_adjustment_id) {
    throw APIError.failedPrecondition("This is a booking — change or delete it from the booking form.");
  }
}

export const cancelEvent = api<CancelEventRequest, CalendarEvent>(
  { auth: true, expose: true, method: "POST", path: "/calendar/events/:id/cancel" },
  async ({ id, reason }) => {
    const userId = await assertCanModifyEvent(id);
    await loadForChange(id);
    const why = reason?.trim();
    if (!why) throw APIError.invalidArgument("Say why it's cancelled.");

    const event = await db.queryRow<CalendarEvent>`
      UPDATE calendar_events
      SET cancelled_at = NOW(), cancelled_by = ${userId}, cancel_reason = ${why}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!event) throw APIError.notFound("Event not found");

    // Its task comes off the watch's board while it's cancelled.
    await removeOpenLinkedTasks(id);

    await notifyIfOtherWatch(await eventWatch(id), id, "Your watch calendar was changed",
      (by) => `${by} cancelled "${event.title}" (${ukDay(event.start_time)}) — ${why}.`);

    await logActivity({
      user_id: userId,
      action: "cancel_calendar_event",
      entity_type: "calendar_event",
      entity_id: id.toString(),
      details: { reason: why },
    });
    return event;
  }
);

export const reinstateEvent = api<{ id: number }, CalendarEvent>(
  { auth: true, expose: true, method: "POST", path: "/calendar/events/:id/reinstate" },
  async ({ id }) => {
    const userId = await assertCanModifyEvent(id);
    await loadForChange(id);

    const event = await db.queryRow<CalendarEvent>`
      UPDATE calendar_events
      SET cancelled_at = NULL, cancelled_by = NULL, cancel_reason = NULL, updated_at = NOW()
      WHERE id = ${id} AND cancelled_at IS NOT NULL
      RETURNING *
    `;
    if (!event) throw APIError.failedPrecondition("This event isn't cancelled.");

    // Station/watch events get their task back.
    if (event.calendar_visibility !== "personal" && !event.source_type) {
      await createLinkedTask(event, userId);
    }

    await notifyIfOtherWatch(await eventWatch(id), id, "Your watch calendar was changed",
      (by) => `${by} reinstated "${event.title}" (${ukDay(event.start_time)}).`);

    await logActivity({
      user_id: userId,
      action: "reinstate_calendar_event",
      entity_type: "calendar_event",
      entity_id: id.toString(),
      details: {},
    });
    return event;
  }
);
