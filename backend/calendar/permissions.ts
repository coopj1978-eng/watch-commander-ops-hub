import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

/** Creator of the event, or any WC/CC, may edit or delete it. Returns the caller's user id. */
export async function assertCanModifyEvent(eventId: number): Promise<string> {
  const auth = getAuthData()!;
  const event = await db.queryRow<{ created_by: string | null }>`
    SELECT created_by FROM calendar_events WHERE id = ${eventId}
  `;
  if (!event) throw APIError.notFound("Event not found");
  const isManager = auth.role === "WC" || auth.role === "CC";
  if (!isManager && event.created_by !== auth.userID) {
    throw APIError.permissionDenied("You can only change events you created");
  }
  return auth.userID;
}
