import { api } from "encore.dev/api";
import db from "../db";
import { logActivity } from "../logging/logger";
import { assertCanModifyEvent } from "./permissions";
import { cascadeDeleteAdjustment, loadAdjustment } from "../shift-adjustments/events";

interface DeleteEventRequest {
  id: number;
  /** Ignored — the caller is taken from the auth token. */
  user_id?: string;
}

export const deleteEvent = api<DeleteEventRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/calendar/events/:id" },
  async ({ id }) => {
    const user_id = await assertCanModifyEvent(id);
    // Look up the event's source links so we can cascade properly:
    //   • source_type='hfsv' → unmark the activity slot so it can be
    //     re-scheduled
    //   • shift_adjustment_id IS NOT NULL → the event is the visible
    //     half of a shift adjustment (TOIL / H4H / Flexi / Orange Day
    //     / Flexi Payback). Deleting the calendar event without
    //     deleting the adjustment leaves the underlying record + any
    //     TOIL spent ledger row + the OTHER linked calendar events
    //     (personal + watch + cover-person) all orphaned. Cascade by
    //     deleting the shift_adjustment plus its dependents.
    const event = await db.rawQueryRow<{
      source_type: string | null;
      source_id: number | null;
      shift_adjustment_id: number | null;
    }>(
      `SELECT source_type, source_id, shift_adjustment_id
       FROM calendar_events WHERE id = $1`,
      id
    );

    if (event?.source_type === "hfsv" && event.source_id) {
      await db.exec`UPDATE activity_records SET scheduled = false, updated_at = NOW() WHERE id = ${event.source_id}`;
    }

    if (event?.shift_adjustment_id) {
      // Cascade through the shift_adjustment lifecycle. Inline rather
      // than calling the deleteAdjustment endpoint cross-service so the
      // activity log records the user's actual click on "Delete Event"
      // and the work happens in one transaction-ish block.
      const adjId = event.shift_adjustment_id;
      const adj = await loadAdjustment(adjId);
      if (adj) {
        // Same cascade as deleting the adjustment directly: TOIL refund,
        // H4H unwind, every linked calendar event, then the adjustment.
        await cascadeDeleteAdjustment(adj);
      } else {
        await db.exec`DELETE FROM calendar_events WHERE shift_adjustment_id = ${adjId}`;
      }

      await logActivity({
        user_id,
        action: "delete_calendar_event_cascade_adjustment",
        entity_type: "shift_adjustment",
        entity_id: adjId.toString(),
        details: { from_calendar_event: id, type: adj?.type },
      });
      return;
    }

    // Plain calendar event (no shift_adjustment link, no HFSV link).
    // Delete any tasks tied to it, then drop the event itself.
    await db.exec`DELETE FROM tasks WHERE calendar_event_id = ${id}`;
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
