import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { PolicyQuery } from "./types";

interface QueryHistoryRequest {
  user_id?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface QueryHistoryResponse {
  queries: PolicyQuery[];
  total: number;
}

export const queryHistory = api<QueryHistoryRequest, QueryHistoryResponse>(
  { expose: true, method: "GET", path: "/policies/queries", auth: true },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    let query = `SELECT * FROM policy_queries`;
    let countQuery = `SELECT COUNT(*) as count FROM policy_queries`;
    const params: any[] = [];
    let paramIndex = 1;

    if (req.user_id) {
      const whereClause = ` WHERE asked_by_user_id = $${paramIndex}`;
      query += whereClause;
      countQuery += whereClause;
      params.push(req.user_id);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const queries = await db.rawQueryAll<PolicyQuery>(query, ...params);
    const countParams = req.user_id ? [req.user_id] : [];
    const countResult = await db.rawQueryRow<{ count: number }>(countQuery, ...countParams);

    return {
      queries,
      total: countResult?.count || 0,
    };
  }
);
