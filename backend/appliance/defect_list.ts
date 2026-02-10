import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { EquipmentDefect, ListDefectsResponse } from "./types";

interface ListDefectsRequest {
  appliance_id?: Query<number>;
  status?: Query<string>;
}

interface DefectRow extends EquipmentDefect {
  equipment_name: string;
  appliance_call_sign: string;
  reported_by_name: string;
}

export const listDefects = api<ListDefectsRequest, ListDefectsResponse>(
  { auth: true, expose: true, method: "GET", path: "/appliances/defects" },
  async (req) => {
    let query = `
      SELECT d.*,
        ei.name as equipment_name,
        a.call_sign as appliance_call_sign,
        u.name as reported_by_name
      FROM equipment_defects d
      JOIN equipment_items ei ON ei.id = d.equipment_item_id
      JOIN appliances a ON a.id = d.appliance_id
      JOIN users u ON u.id = d.reported_by
    `;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.appliance_id) {
      conditions.push(`d.appliance_id = $${paramIndex++}`);
      params.push(req.appliance_id);
    }
    if (req.status) {
      conditions.push(`d.status = $${paramIndex++}`);
      params.push(req.status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY d.reported_at DESC`;

    const defects = await db.rawQueryAll<DefectRow>(query, ...params);

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return {
      defects: defects.map((d) => ({
        ...d,
        overdue: d.status === "Open" && (now - new Date(d.reported_at).getTime()) > THIRTY_DAYS_MS,
      })),
    };
  }
);
