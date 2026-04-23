import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type {
  Bulletin,
  BulletinScope,
  BulletinPriority,
  BulletinReadStats,
  GetBulletinStatsResponse,
} from "./types";

interface GetStatsRequest {
  id: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /bulletins/:id/stats
//
// Returns the bulletin + a per-recipient read/ack table. Used by the WC
// view on the Bulletins page to answer "who's read it, who hasn't yet."
//
// Access: any WC or CC can see stats for bulletins visible to them. This
// is deliberately not author-only — a WC picking up the shift inherits
// the oncoming watch's bulletins and should be able to see who read what.
// ─────────────────────────────────────────────────────────────────────────────

interface DBBulletin {
  id: number;
  posted_by: string;
  posted_by_name: string | null;
  scope: string;
  watch_unit: string | null;
  title: string;
  body: string;
  priority: string;
  requires_ack: boolean;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface DBAudienceRow {
  user_id: string;
  name: string;
  rank: string | null;
  watch_unit: string | null;
  read_at: Date | null;
  acknowledged_at: Date | null;
}

export const getStats = api<GetStatsRequest, GetBulletinStatsResponse>(
  { auth: true, expose: true, method: "GET", path: "/bulletins/:id/stats" },
  async (req) => {
    const auth = getAuthData()!;

    const caller = await db.queryRow<{ role: string }>`
      SELECT role FROM users WHERE id = ${auth.userID}
    `;
    if (!caller || (caller.role !== "WC" && caller.role !== "CC")) {
      throw APIError.permissionDenied(
        "only a WC or CC can view bulletin read-receipt stats"
      );
    }

    const row = await db.queryRow<DBBulletin>`
      SELECT
        b.id, b.posted_by, b.scope, b.watch_unit,
        b.title, b.body, b.priority, b.requires_ack,
        b.expires_at, b.created_at, b.updated_at,
        u.name AS posted_by_name
      FROM bulletins b
      JOIN users u ON u.id = b.posted_by
      WHERE b.id = ${req.id}
    `;
    if (!row) {
      throw APIError.notFound("bulletin not found");
    }

    // Audience resolution — matches the create.ts dispatch logic. We do
    // this dynamically rather than snapshotting at post time so joining /
    // leaving a watch after the bulletin goes out is correctly reflected.
    //
    // LEFT JOIN bulletin_reads so users who haven't read/acked yet come
    // back with NULLs in those columns.
    let audience: DBAudienceRow[];
    if (row.scope === "station") {
      audience = await db.rawQueryAll<DBAudienceRow>(
        `SELECT u.id AS user_id, u.name, u.rank, u.watch_unit,
                br.read_at, br.acknowledged_at
         FROM users u
         LEFT JOIN bulletin_reads br
           ON br.bulletin_id = $1 AND br.user_id = u.id
         WHERE u.role IN ('WC', 'CC', 'FF')
           AND u.left_at IS NULL
           AND u.id != $2
         ORDER BY
           CASE u.role WHEN 'WC' THEN 0 WHEN 'CC' THEN 1 ELSE 2 END,
           u.name`,
        row.id,
        row.posted_by
      );
    } else {
      audience = await db.rawQueryAll<DBAudienceRow>(
        `SELECT DISTINCT u.id AS user_id, u.name, u.rank, u.watch_unit,
                br.read_at, br.acknowledged_at
         FROM users u
         LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
         LEFT JOIN bulletin_reads br
           ON br.bulletin_id = $1 AND br.user_id = u.id
         WHERE u.role IN ('WC', 'CC', 'FF')
           AND u.left_at IS NULL
           AND u.id != $3
           AND (LOWER(u.watch_unit) = LOWER($2) OR LOWER(fp.watch) = LOWER($2))
         ORDER BY
           CASE u.role WHEN 'WC' THEN 0 WHEN 'CC' THEN 1 ELSE 2 END,
           u.name`,
        row.id,
        row.watch_unit ?? "",
        row.posted_by
      );
    }

    const audienceStats: BulletinReadStats[] = audience.map((a) => ({
      user_id: a.user_id,
      name: a.name,
      rank: a.rank ?? undefined,
      watch_unit: a.watch_unit ?? undefined,
      read_at: a.read_at ? a.read_at.toISOString() : undefined,
      acknowledged_at: a.acknowledged_at
        ? a.acknowledged_at.toISOString()
        : undefined,
    }));

    const readCount = audienceStats.filter((a) => !!a.read_at).length;
    const ackedCount = audienceStats.filter((a) => !!a.acknowledged_at).length;

    const bulletin: Bulletin = {
      id: row.id,
      posted_by: row.posted_by,
      posted_by_name: row.posted_by_name ?? undefined,
      scope: row.scope as BulletinScope,
      watch_unit: row.watch_unit ?? undefined,
      title: row.title,
      body: row.body,
      priority: row.priority as BulletinPriority,
      requires_ack: row.requires_ack,
      expires_at: row.expires_at ? row.expires_at.toISOString() : undefined,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      audience_count: audienceStats.length,
      read_count: readCount,
      acknowledged_count: ackedCount,
    };

    return { bulletin, audience: audienceStats };
  }
);
