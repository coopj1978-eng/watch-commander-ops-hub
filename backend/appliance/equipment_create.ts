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

    const name = req.name.trim();
    if (!name) throw APIError.invalidArgument("Give the item a name.");

    // No place given: it goes at the end of the appliance's list.
    const item = await db.queryRow<EquipmentItem>`
      INSERT INTO equipment_items (appliance_id, name, category, serial_number, quantity, locker, shelf, sort_order)
      VALUES (
        ${req.appliance_id}, ${name}, ${req.category}, ${req.serial_number || null}, ${req.quantity || 1},
        ${req.locker?.trim() || null}, ${req.shelf?.trim() || null},
        COALESCE(${req.sort_order ?? null}::int,
                 (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM equipment_items WHERE appliance_id = ${req.appliance_id}))
      )
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
