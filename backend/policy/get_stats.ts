import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type {
  PolicyDoc,
  PolicyAckStats,
  GetPolicyStatsResponse,
} from "./types";

interface GetStatsRequest {
  id: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /policies/:id/stats
//
// Per-user read-receipt table for a given policy. Gated to WC/CC — a FF
// doesn't need to know who else has acknowledged what. The audience is
// every active WC/CC/FF on the service; for policies a station-wide
// audience is always appropriate (docs aren't watch-scoped).
//
// Only the current `version` counts — if the policy has been re-uploaded
// under a new version string, everyone's "acknowledged_at" resets visually
// even though the historic rows are retained in policy_acknowledgements.
// ─────────────────────────────────────────────────────────────────────────────

interface DBPolicy extends PolicyDoc {}

interface DBAudienceRow {
  user_id: string;
  name: string;
  rank: string | null;
  watch_unit: string | null;
  acknowledged_at: Date | null;
  acknowledged_version: string | null;
}

export const getStats = api<GetStatsRequest, GetPolicyStatsResponse>(
  { auth: true, expose: true, method: "GET", path: "/policies/:id/stats" },
  async (req) => {
    const auth = getAuthData()!;

    const caller = await db.queryRow<{ role: string }>`
      SELECT role FROM users WHERE id = ${auth.userID}
    `;
    if (!caller || (caller.role !== "WC" && caller.role !== "CC")) {
      throw APIError.permissionDenied(
        "only a WC or CC can view policy acknowledgement stats"
      );
    }

    const policy = await db.queryRow<DBPolicy>`
      SELECT * FROM policy_docs WHERE id = ${req.id}
    `;
    if (!policy) {
      throw APIError.notFound("policy not found");
    }

    // Audience: every active crew member (WC/CC/FF). We LEFT JOIN the acks
    // table restricted to the policy's current version so "acknowledged"
    // means "acknowledged at the latest version."
    const audience = await db.rawQueryAll<DBAudienceRow>(
      `SELECT u.id AS user_id, u.name, u.rank, u.watch_unit,
              pa.acknowledged_at,
              pa.version AS acknowledged_version
       FROM users u
       LEFT JOIN policy_acknowledgements pa
         ON pa.policy_id = $1
        AND pa.user_id = u.id
        AND pa.version IS NOT DISTINCT FROM $2
       WHERE u.role IN ('WC', 'CC', 'FF')
         AND u.left_at IS NULL
       ORDER BY
         CASE u.role WHEN 'WC' THEN 0 WHEN 'CC' THEN 1 ELSE 2 END,
         u.name`,
      req.id,
      policy.version ?? null
    );

    const audienceStats: PolicyAckStats[] = audience.map((a) => ({
      user_id: a.user_id,
      name: a.name,
      rank: a.rank ?? undefined,
      watch_unit: a.watch_unit ?? undefined,
      acknowledged_at: a.acknowledged_at?.toISOString(),
      acknowledged_version: a.acknowledged_version ?? undefined,
    }));

    const ackedCount = audienceStats.filter((a) => !!a.acknowledged_at).length;

    return {
      policy: {
        ...policy,
        audience_count: audienceStats.length,
        acknowledged_count: ackedCount,
      },
      audience: audienceStats,
    };
  }
);
