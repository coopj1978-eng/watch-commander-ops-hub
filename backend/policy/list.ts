import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
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
  /** How many policies have requires_ack=true AND the caller has NOT yet
   *  acknowledged the current version. Drives the dashboard tile badge. */
  unacked_required_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /policies
//
// Returns policy docs plus per-caller acknowledgement status. For each row
// we LEFT JOIN policy_acknowledgements restricted to the caller and matching
// the policy's current `version` — so uploading a new version of the same
// doc correctly resets the is_acknowledged flag.
// ─────────────────────────────────────────────────────────────────────────────

interface DBRow extends PolicyDoc {
  is_acknowledged: boolean;
}

export const list = api<ListPoliciesRequest, ListPoliciesResponse>(
  { expose: true, method: "GET", path: "/policies", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    const params: any[] = [auth.userID];
    let paramIndex = 2;
    let whereClause = "";

    if (req.category) {
      whereClause = ` WHERE pd.category = $${paramIndex}`;
      params.push(req.category);
      paramIndex++;
    }

    // LEFT JOIN the caller's ack row for the current `version` of each
    // policy. `version IS NOT DISTINCT FROM` handles the NULL-version case
    // symmetrically so a NULL-version ack matches only a NULL-version doc.
    const query = `
      SELECT pd.*,
             (pa.id IS NOT NULL) AS is_acknowledged
      FROM policy_docs pd
      LEFT JOIN policy_acknowledgements pa
        ON pa.policy_id = pd.id
       AND pa.user_id = $1
       AND pa.version IS NOT DISTINCT FROM pd.version
      ${whereClause}
      ORDER BY pd.uploaded_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const rows = await db.rawQueryAll<DBRow>(query, ...params);

    const countResult = await db.rawQueryRow<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM policy_docs pd${whereClause}`,
      ...(req.category ? [req.category] : [])
    );

    // Count required-and-unacknowledged for the badge. Independent of
    // category filter — dashboard cares about everything the caller
    // hasn't ticked off.
    const unackedCountRow = await db.rawQueryRow<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM policy_docs pd
       LEFT JOIN policy_acknowledgements pa
         ON pa.policy_id = pd.id
        AND pa.user_id = $1
        AND pa.version IS NOT DISTINCT FROM pd.version
       WHERE pd.requires_ack = true
         AND pa.id IS NULL`,
      auth.userID
    );

    return {
      policies: rows,
      total: countResult?.count || 0,
      unacked_required_count: unackedCountRow?.count || 0,
    };
  }
);
