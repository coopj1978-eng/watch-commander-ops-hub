import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateEquipmentRequest, EquipmentItem } from "./types";

export const createEquipment = api<CreateEquipmentRequest, EquipmentItem>(
  { auth: true, expose: true, method: "POST", path: "/appliances/equipment" },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC" && auth.role !== "CC") {
      throw APIError.permissionDenied("Only Watch/Crew Commanders can add equipment");
    }

    const item = await db.queryRow<EquipmentItem>`
      INSERT INTO equipment_items (appliance_id, name, category, serial_number, quantity)
      VALUES (${req.appliance_id}, ${req.name}, ${req.category}, ${req.serial_number || null}, ${req.quantity || 1})
      RETURNING *
    `;

    if (!item) {
      throw APIError.internal("Failed to create equipment item");
    }

    await logActivity({
      user_id: auth.userID,
      action: "add_equipment",
      entity_type: "equipment_item",
      entity_id: item.id.toString(),
      details: { appliance_id: req.appliance_id, name: item.name, category: item.category },
    });

    return item;
  }
);
