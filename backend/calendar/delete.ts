import { api } from "encore.dev/api";
import db from "../db";
import { logActivity } from "../logging/logger";

interface DeleteEventRequest {
  id: number;
  user_id: string;
}

export const deleteEvent = api<DeleteEventRequest, void>(
  { expose: true, method: "DELETE", path: "/calendar/events/:id" },
  async ({ id, user_id }) => {
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
