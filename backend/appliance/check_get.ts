import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { EquipmentCheck, EquipmentCheckItem, CheckDetailResponse } from "./types";

interface GetCheckRequest {
  id: number;
}

export const getCheck = api<GetCheckRequest, CheckDetailResponse>(
  { auth: true, expose: true, method: "GET", path: "/appliances/checks/:id" },
  async ({ id }) => {
    const check = await db.queryRow<EquipmentCheck>`
      SELECT * FROM equipment_checks WHERE id = ${id}
    `;

    if (!check) {
      throw APIError.notFound("Equipment check not found");
    }

    const items = await db.queryAll<EquipmentCheckItem & { equipment_name: string; equipment_category: string; equipment_serial: string | null }>`
      SELECT ci.*, ei.name as equipment_name, ei.category as equipment_category, ei.serial_number as equipment_serial
      FROM equipment_check_items ci
      JOIN equipment_items ei ON ei.id = ci.equipment_item_id
      WHERE ci.check_id = ${id}
      ORDER BY ei.category, ei.name
    `;

    const checkedByUser = await db.queryRow<{ name: string }>`
      SELECT name FROM users WHERE id = ${check.checked_by}
    `;

    return {
      check,
      items,
      checked_by_name: checkedByUser?.name || "Unknown",
    };
  }
);
