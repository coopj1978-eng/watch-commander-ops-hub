import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { EquipmentItem, ListEquipmentResponse } from "./types";

interface ListEquipmentRequest {
  appliance_id: Query<number>;
  active_only?: Query<boolean>;
}

export const listEquipment = api<ListEquipmentRequest, ListEquipmentResponse>(
  { auth: true, expose: true, method: "GET", path: "/appliances/equipment" },
  async (req) => {
    const activeOnly = req.active_only !== false;

    const items = activeOnly
      ? await db.queryAll<EquipmentItem>`
          SELECT * FROM equipment_items WHERE appliance_id = ${req.appliance_id} AND active = true ORDER BY category, name
        `
      : await db.queryAll<EquipmentItem>`
          SELECT * FROM equipment_items WHERE appliance_id = ${req.appliance_id} ORDER BY category, name
        `;

    return { items };
  }
);
