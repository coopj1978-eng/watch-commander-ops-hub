import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type {
  Bulletin,
  BulletinScope,
  BulletinPriority,
  ListBulletinsRequest,
  ListBulletinsResponse,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// GET /bulletins
//
// Returns bulletins visible to the caller. Visibility:
//   • Station-scoped: visible to everyone
//   • Watch-scoped: visible only to users on that watch (either via
//     users.watch_unit or firefighter_profiles.watch)
//
// By default, filters OUT expired bulletins and ones the caller has already
// read (keeps the dashboard "what's new for me" list clean). Pass
// `include_read=true` to get the full history for the Bulletins page.
//
// Each row includes per-caller `is_read` and `is_acknowledged` flags so the
// UI can render accurate state without a second round-trip.
// ─────────────────────────────────────────────────────────────────────────────

interface DBBulletinRow {
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
  read_at: Date | null;
  acknowledged_at: Date | null;
}

export const list = api<ListBulletinsRequest, ListBulletinsResponse>(
  { auth: true, expose: true, method: "GET", path: "/api/bulletins" },
  async (req) => {
    const auth = getAuthData()!;
    const limit = Math.min(req.limit ?? 50, 200);
    const offset = req.offset ?? 0;
    const includeRead = req.include_read === true;

    // Resolve the caller's effective watch once — used to decide which
    // watch-scoped bulletins are visible. COALESCE matches the pattern in
    // crew/get_stats.ts so anyone whose users.watch_unit drifted from their
    // profile still gets the right scope.
    const caller = await db.queryRow<{ watch: string | null }>`
      SELECT LOWER(COALESCE(u.watch_unit, fp.watch)) AS watch
      FROM users u
      LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
      WHERE u.id = ${auth.userID}
    `;
    const callerWatch = caller?.watch ?? null;

    // Visibility predicate:
    //   • scope='station' always visible
    //   • scope='watch' visible if bulletin.watch_unit matches caller's watch
    const visibilityCondition = `(
      b.scope = 'station'
      OR (b.scope = 'watch' AND LOWER(b.watch_unit) = $1)
    )`;

    const extraFilters: string[] = [];
    if (!includeRead) {
      // Hide expired (past expires_at) in the "unread" view. Past expiries
      // still show up in the full history.
      extraFilters.push(`(b.expires_at IS NULL OR b.expires_at > NOW())`);
      // Hide fully-read items. A bulletin counts as "done" for the caller
      // when they have a read row AND (no ack required OR acknowledged).
      extraFilters.push(`
        NOT (
          br.read_at IS NOT NULL
          AND (b.requires_ack = false OR br.acknowledged_at IS NOT NULL)
        )
      `);
    }

    const whereClause = `WHERE ${visibilityCondition}${
      extraFilters.length ? " AND " + extraFilters.join(" AND ") : ""
    }`;

    // Main SELECT — LEFT JOIN bulletin_reads on (bulletin_id, caller) so
    // we get one row per bulletin with the caller's read/ack status.
    const rows = await db.rawQueryAll<DBBulletinRow>(
      `SELECT
         b.id, b.posted_by, b.scope, b.watch_unit,
         b.title, b.body, b.priority, b.requires_ack,
         b.expires_at, b.created_at, b.updated_at,
         u.name AS posted_by_name,
         br.read_at, br.acknowledged_at
       FROM bulletins b
       JOIN users u ON u.id = b.posted_by
       LEFT JOIN bulletin_reads br
         ON br.bulletin_id = b.id AND br.user_id = $2
       ${whereClause}
       ORDER BY
         CASE b.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
         b.created_at DESC
       LIMIT $3 OFFSET $4`,
      callerWatch,
      auth.userID,
      limit,
      offset
    );

    const totalRow = await db.rawQueryRow<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM bulletins b
       LEFT JOIN bulletin_reads br
         ON br.bulletin_id = b.id AND br.user_id = $2
       ${whereClause}`,
      callerWatch,
      auth.userID
    );

    // Separate counts for dashboard badges — unread vs unacked (subset of
    // unread where requires_ack=true and the user hasn't acknowledged).
    const countsRow = await db.rawQueryRow<{
      unread: number;
      unacked: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE br.read_at IS NULL)::int AS unread,
         COUNT(*) FILTER (WHERE b.requires_ack = true AND br.acknowledged_at IS NULL)::int AS unacked
       FROM bulletins b
       LEFT JOIN bulletin_reads br
         ON br.bulletin_id = b.id AND br.user_id = $2
       WHERE ${visibilityCondition}
         AND (b.expires_at IS NULL OR b.expires_at > NOW())`,
      callerWatch,
      auth.userID
    );

    const bulletins: Bulletin[] = rows.map((r) => ({
      id: r.id,
      posted_by: r.posted_by,
      posted_by_name: r.posted_by_name ?? undefined,
      scope: r.scope as BulletinScope,
      watch_unit: r.watch_unit ?? undefined,
      title: r.title,
      body: r.body,
      priority: r.priority as BulletinPriority,
      requires_ack: r.requires_ack,
      expires_at: r.expires_at ? r.expires_at.toISOString() : undefined,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
      is_read: !!r.read_at,
      is_acknowledged: !!r.acknowledged_at,
    }));

    return {
      bulletins,
      total: totalRow?.total ?? 0,
      unread_count: countsRow?.unread ?? 0,
      unacked_count: countsRow?.unacked ?? 0,
    };
  }
);
