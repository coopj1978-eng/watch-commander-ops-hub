import { api } from "encore.dev/api";
import db from "../db";
import { logActivity } from "../logging/logger";

interface DeleteEventRequest {
  id: number;
  user_id: string;
}

export const deleteEvent = api<DeleteEventRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/calendar/events/:id" },
  async ({ id, user_id }) => {
    // Check if this event has a linked HFSV source — unmark the slot so it can be re-used
    const event = await db.rawQueryRow<{ source_type: string | null; source_id: number | null }>(
      `SELECT source_type, source_id FROM calendar_events WHERE id = $1`, id
    );
    if (event?.source_type === "hfsv" && event.source_id) {
      await db.exec`UPDATE activity_records SET scheduled = false, updated_at = NOW() WHERE id = ${event.source_id}`;
    }

    // Delete any linked tasks
    await db.exec`DELETE FROM tasks WHERE calendar_event_id = ${id}`;

    // Delete the calendar event
    await db.exec`DELETE FROM calendar_events WHERE id = ${id}`;

    await logActivity({
      user_id: user_id,
      action: "delete_calendar_event",
      entity_type: "calendar_event",
      entity_id: id.toString(),
      details: {},
    });
  }
);
