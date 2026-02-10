import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { EquipmentCheck, ListChecksResponse } from "./types";

interface ListChecksRequest {
  appliance_id?: Query<number>;
  checked_by?: Query<string>;
  watch?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

export const listChecks = api<ListChecksRequest, ListChecksResponse>(
  { auth: true, expose: true, method: "GET", path: "/appliances/checks" },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM equipment_checks`;
    let countQuery = `SELECT COUNT(*) as count FROM equipment_checks`;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.appliance_id) {
      conditions.push(`appliance_id = $${paramIndex++}`);
      params.push(req.appliance_id);
    }
    if (req.checked_by) {
      conditions.push(`checked_by = $${paramIndex++}`);
      params.push(req.checked_by);
    }
    if (req.watch) {
      conditions.push(`watch = $${paramIndex++}`);
      params.push(req.watch);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const checks = await db.rawQueryAll<EquipmentCheck>(query, ...params);
    const countParams = params.slice(0, -2);
    const countResult = await db.rawQueryRow<{ count: number }>(
      countQuery,
      ...countParams
    );

    return {
      checks,
      total: countResult?.count || 0,
    };
  }
);
