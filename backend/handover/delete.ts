import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

interface DeleteHandoverRequest {
  id: number;
}

interface DeleteHandoverResponse {
  success: boolean;
}

export const deleteHandover = api<DeleteHandoverRequest, DeleteHandoverResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/handovers/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;

    const existing = await db.queryRow<{ id: number; written_by_user_id: string }>`
      SELECT id, written_by_user_id FROM handovers WHERE id = ${id}
    `;

    if (!existing) {
      throw APIError.notFound("handover not found");
    }

    if (existing.written_by_user_id !== auth.userID && auth.role !== "WC") {
      throw APIError.permissionDenied("only the author or a Watch Commander can delete this handover");
    }

    await db.exec`DELETE FROM handovers WHERE id = ${id}`;

    await logActivity({
      user_id: auth.userID,
      action: "delete_handover",
      entity_type: "handover",
      entity_id: id.toString(),
      details: {},
    });

    return { success: true };
  }
);
