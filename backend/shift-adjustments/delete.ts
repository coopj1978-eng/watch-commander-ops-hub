import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { cascadeDeleteAdjustment, loadAdjustment } from "./events";

interface DeleteShiftAdjustmentRequest {
  id: number;
}

export const deleteAdjustment = api<DeleteShiftAdjustmentRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/shift-adjustments/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await loadAdjustment(req.id);
    if (!existing) throw APIError.notFound("Shift adjustment not found.");

    // The owner can always delete their own; a WC/CC only on their own watch.
    const isOwn = existing.user_id === auth.userID;
    if (!isOwn) {
      const isManager = auth.role === "WC" || auth.role === "CC";
      if (!isManager) {
        throw APIError.permissionDenied("You can only delete your own shift adjustments.");
      }
      const caller = await db.queryRow<{ watch_unit: string | null }>`
        SELECT watch_unit FROM users WHERE id = ${auth.userID}
      `;
      const sameWatch =
        !!caller?.watch_unit &&
        caller.watch_unit.toLowerCase() === (existing.watch_unit ?? "").toLowerCase();
      if (!sameWatch) {
        throw APIError.permissionDenied("You can only delete shift adjustments for your own watch.");
      }
    }

    await cascadeDeleteAdjustment(existing);

    await logActivity({
      user_id: auth.userID,
      action: "delete_shift_adjustment",
      entity_type: "shift_adjustment",
      entity_id: req.id.toString(),
      details: { type: existing.type, user_id: existing.user_id },
    });
  }
);
