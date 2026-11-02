import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { canModifyAdjustment, loadAdjustment } from "../shift-adjustments/events";

/**
 * Creator of the event, or any WC/CC, may edit or delete it. An event that
 * shows a shift adjustment follows the booking's rule instead (the person
 * it belongs to, the person covering, or any WC/CC). A reminder (a note's
 * follow-up carries part of the private note) is its creator's alone.
 * Returns the caller's user id.
 */
export async function assertCanModifyEvent(eventId: number): Promise<string> {
  const auth = getAuthData()!;
  const event = await db.queryRow<{ created_by: string | null; shift_adjustment_id: number | null; event_type: string }>`
    SELECT created_by, shift_adjustment_id, event_type FROM calendar_events WHERE id = ${eventId}
  `;
  if (!event) throw APIError.notFound("Event not found");
  if (event.event_type === "reminder") {
    if (event.created_by !== auth.userID) throw APIError.notFound("Event not found");
    return auth.userID;
  }
  if (event.shift_adjustment_id) {
    const adj = await loadAdjustment(event.shift_adjustment_id);
    if (adj && canModifyAdjustment(adj, auth)) return auth.userID;
  }
  const isManager = auth.role === "WC" || auth.role === "CC";
  if (!isManager && event.created_by !== auth.userID) {
    throw APIError.permissionDenied("You can only change events you created");
  }
  return auth.userID;
}
