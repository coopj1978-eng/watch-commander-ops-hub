import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

interface DeleteToilRequest {
  id: number;
}

interface DeleteToilResponse {
  ok: true;
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /toil/:id
//
// Removes a TOIL ledger entry. Used when a WC/CC has logged hours
// incorrectly (wrong person, wrong amount, wrong incident date) and needs
// to back it out.
//
// Permission rules:
//   • The author of the entry can delete it themselves
//   • Any WC can delete any entry
//   • CC can delete entries on their own watch but not station-wide
//
// Spent entries linked to a shift_adjustment are still allowed to be
// deleted here — the activity log records the deletion and the WC is
// expected to also delete the corresponding shift adjustment if needed.
// (The schema FK is ON DELETE SET NULL, so deleting the adjustment first
// would leave the spent row orphaned but valid.)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteToil = api<DeleteToilRequest, DeleteToilResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/toil/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const caller = await db.queryRow<{ role: string; watch_unit: string | null }>`
      SELECT role, watch_unit FROM users WHERE id = ${auth.userID}
    `;
    if (!caller) {
      throw APIError.unauthenticated("Caller not found.");
    }

    const existing = await db.queryRow<{
      id: number;
      created_by: string;
      watch_unit: string;
      hours: string;
      type: string;
    }>`
      SELECT id, created_by, watch_unit, hours, type
      FROM toil_ledger
      WHERE id = ${req.id}
    `;
    if (!existing) {
      throw APIError.notFound("TOIL entry not found.");
    }

    const isAuthor = existing.created_by === auth.userID;
    const isWC = caller.role === "WC";
    const isCCOnSameWatch =
      caller.role === "CC" &&
      caller.watch_unit?.toLowerCase() === existing.watch_unit.toLowerCase();

    if (!isAuthor && !isWC && !isCCOnSameWatch) {
      throw APIError.permissionDenied(
        "You can only delete TOIL entries you logged, or any entry as a WC, or entries on your watch as a CC."
      );
    }

    await db.exec`DELETE FROM toil_ledger WHERE id = ${req.id}`;

    await logActivity({
      user_id: auth.userID,
      action: "delete_toil_entry",
      entity_type: "toil",
      entity_id: req.id.toString(),
      details: {
        type: existing.type,
        hours: existing.hours,
        watch: existing.watch_unit,
      },
    });

    return { ok: true };
  }
);
