import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { logActivity } from "../logging/logger";
import { canModifyAdjustment, cascadeDeleteAdjustment, loadAdjustment } from "./events";

interface DeleteShiftAdjustmentRequest {
  id: number;
}

export const deleteAdjustment = api<DeleteShiftAdjustmentRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/shift-adjustments/:id" },
  async (req) => {
    const auth = getAuthData()!;

    const existing = await loadAdjustment(req.id);
    if (!existing) throw APIError.notFound("Shift adjustment not found.");

    if (!canModifyAdjustment(existing, auth)) {
      throw APIError.permissionDenied(
        "Only the person it belongs to, the person covering it, or a WC/CC can delete this."
      );
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
