import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateEquipmentRequest, EquipmentItem } from "./types";

export const updateEquipment = api<UpdateEquipmentRequest, EquipmentItem>(
  { auth: true, expose: true, method: "PATCH", path: "/appliances/equipment/:id" },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC" && auth.role !== "CC") {
      throw APIError.permissionDenied("Only Watch/Crew Commanders can update equipment");
    }

    const { id, ...updates } = req;
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      params.push(updates.category);
    }
    if (updates.serial_number !== undefined) {
      setClauses.push(`serial_number = $${paramIndex++}`);
      params.push(updates.serial_number);
    }
    if (updates.quantity !== undefined) {
      setClauses.push(`quantity = $${paramIndex++}`);
      params.push(updates.quantity);
    }
    if (updates.active !== undefined) {
      setClauses.push(`active = $${paramIndex++}`);
      params.push(updates.active);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("No updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE equipment_items SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
    const item = await db.rawQueryRow<EquipmentItem>(query, ...params);

    if (!item) {
      throw APIError.notFound("Equipment item not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_equipment",
      entity_type: "equipment_item",
      entity_id: id.toString(),
      details: updates,
    });

    return item;
  }
);
