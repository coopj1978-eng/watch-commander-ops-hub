import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { PolicyDoc } from "./types";

interface ListPoliciesRequest {
  category?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListPoliciesResponse {
  policies: PolicyDoc[];
  total: number;
}

export const list = api<ListPoliciesRequest, ListPoliciesResponse>(
  { expose: true, method: "GET", path: "/policies", auth: true },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM policy_docs`;
    let countQuery = `SELECT COUNT(*) as count FROM policy_docs`;
    const params: any[] = [];
    let paramIndex = 1;

    if (req.category) {
      const whereClause = ` WHERE category = $${paramIndex}`;
      query += whereClause;
      countQuery += whereClause;
      params.push(req.category);
      paramIndex++;
    }

    query += ` ORDER BY uploaded_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const policies = await db.rawQueryAll<PolicyDoc>(query, ...params);
    const countParams = req.category ? [req.category] : [];
    const countResult = await db.rawQueryRow<{ count: number }>(countQuery, ...countParams);

    return {
      policies,
      total: countResult?.count || 0,
    };
  }
);
