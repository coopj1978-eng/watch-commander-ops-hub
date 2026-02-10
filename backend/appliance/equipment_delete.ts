import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { EquipmentItem } from "./types";

interface DeleteEquipmentRequest {
  id: number;
}

export const deleteEquipment = api<DeleteEquipmentRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/appliances/equipment/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC") {
      throw APIError.permissionDenied("Only Watch Commanders can remove equipment");
    }

    // Soft-delete by deactivating rather than hard delete (preserves history)
    const item = await db.rawQueryRow<EquipmentItem>(
      `UPDATE equipment_items SET active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      id
    );

    if (!item) {
      throw APIError.notFound("Equipment item not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "remove_equipment",
      entity_type: "equipment_item",
      entity_id: id.toString(),
      details: { name: item.name, appliance_id: item.appliance_id },
    });
  }
);
