import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { Inspection, InspectionStatus } from "./types";

interface ListInspectionsRequest {
  status?: Query<InspectionStatus>;
  inspector_id?: Query<string>;
  inspection_type?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListInspectionsResponse {
  inspections: Inspection[];
  total: number;
}

export const list = api<ListInspectionsRequest, ListInspectionsResponse>(
  { expose: true, method: "GET", path: "/inspections" },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM inspections`;
    let countQuery = `SELECT COUNT(*) as count FROM inspections`;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(req.status);
    }
    if (req.inspector_id) {
      conditions.push(`inspector_id = $${paramIndex++}`);
      params.push(req.inspector_id);
    }
    if (req.inspection_type) {
      conditions.push(`inspection_type = $${paramIndex++}`);
      params.push(req.inspection_type);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY scheduled_for DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const inspections = await db.rawQueryAll<Inspection>(query, ...params);
    const countParams = params.slice(0, -2);
    const countResult = await db.rawQueryRow<{ count: number }>(countQuery, ...countParams);

    return {
      inspections,
      total: countResult?.count || 0,
    };
  }
);
