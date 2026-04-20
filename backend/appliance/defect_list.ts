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
    // LEFT JOIN on equipment + appliance so appliance-level defects (no
    // equipment item) and station-level defects (no equipment, no appliance)
    // still come back from this query. COALESCE the names to empty strings
    // to keep the API shape stable — the frontend already renders a blank
    // when the name is missing.
    let query = `
      SELECT d.*,
        COALESCE(ei.name, '')      AS equipment_name,
        COALESCE(a.call_sign, '')  AS appliance_call_sign,
        u.name                     AS reported_by_name
      FROM equipment_defects d
      LEFT JOIN equipment_items ei ON ei.id = d.equipment_item_id
      LEFT JOIN appliances a       ON a.id  = d.appliance_id
      JOIN users u                 ON u.id  = d.reported_by
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
