import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

interface DeleteShiftAdjustmentRequest {
  id: number;
}

export const deleteAdjustment = api<DeleteShiftAdjustmentRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/shift-adjustments/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<{ user_id: string; watch_unit: string }>`
      SELECT user_id, watch_unit FROM shift_adjustments WHERE id = ${req.id}
    `;

    if (!existing) throw APIError.notFound("Shift adjustment not found.");

    // Only the owner or a WC/CC on the same watch can delete
    const isOwn = existing.user_id === auth.userID;
    const isManager = auth.role === "WC" || auth.role === "CC";

    if (!isOwn && !isManager) {
      throw APIError.permissionDenied("You can only delete your own shift adjustments.");
    }

    await db.exec`DELETE FROM shift_adjustments WHERE id = ${req.id}`;
  }
);
