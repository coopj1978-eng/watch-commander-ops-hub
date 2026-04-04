import { api } from "encore.dev/api";
import db from "../db";
import type {
  ListDetachmentsRequest,
  ListDetachmentsResponse,
  GetRotaRequest,
  GetRotaResponse,
  RotaMember,
} from "./types";

// GET /detachments — list detachment history, optionally filtered by watch
export const list = api<ListDetachmentsRequest, ListDetachmentsResponse>(
  { auth: true, expose: true, method: "GET", path: "/detachments" },
  async (req) => {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (req.watch) {
      conditions.push(`home_watch = $${p++}`);
      params.push(req.watch);
    }

    const where  = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit  = req.limit  ?? 50;
    const offset = req.offset ?? 0;

    const rows = db.rawQuery<{
      id: number;
      firefighter_id: string;
      firefighter_name: string;
      home_watch: string;
      to_station: string;
      detachment_date: string;
      reason: string | null;
      notes: string | null;
      recorded_by_user_id: string;
      created_at: string;
    }>(
      `SELECT id, firefighter_id, firefighter_name, home_watch, to_station,
              detachment_date::text, reason, notes, recorded_by_user_id, created_at::text
       FROM detachments ${where}
       ORDER BY detachment_date DESC, created_at DESC
       LIMIT $${p++} OFFSET $${p++}`,
      ...params, limit, offset,
    );

    const countRow = await db.rawQueryRow<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM detachments ${where}`,
      ...(conditions.length > 0 ? params : []),
    );

    const detachments = [];
    for await (const row of rows) {
      detachments.push({
        ...row,
        reason: row.reason ?? undefined,
        notes:  row.notes  ?? undefined,
      });
    }

    return { detachments, total: countRow?.count ?? 0 };
  },
);

// GET /detachments/rota — fairness rota: all watch members sorted by last detachment (oldest first = next in line)
export const getRota = api<GetRotaRequest, GetRotaResponse>(
  { auth: true, expose: true, method: "GET", path: "/detachments/rota" },
  async (req) => {
    const rows = db.rawQuery<{
      firefighter_id: string;
      firefighter_name: string;
      watch_unit: string;
      last_detachment_date: string | null;
      last_to_station: string | null;
      last_reason: string | null;
      total_detachments: number;
    }>(
      `SELECT
         u.id   AS firefighter_id,
         u.name AS firefighter_name,
         u.watch_unit,
         d.last_detachment_date,
         d.last_to_station,
         d.last_reason,
         COALESCE(d.total_detachments, 0)::int AS total_detachments
       FROM users u
       LEFT JOIN LATERAL (
         SELECT
           detachment_date::text AS last_detachment_date,
           to_station            AS last_to_station,
           reason                AS last_reason,
           (SELECT COUNT(*)::int FROM detachments WHERE firefighter_id = u.id) AS total_detachments
         FROM detachments
         WHERE firefighter_id = u.id
         ORDER BY detachment_date DESC
         LIMIT 1
       ) d ON true
       WHERE u.watch_unit = $1
         AND u.role IN ('WC', 'CC', 'FF')
       ORDER BY d.last_detachment_date ASC NULLS FIRST, u.name ASC`,
      req.watch,
    );

    const members: RotaMember[] = [];
    for await (const row of rows) {
      members.push(row);
    }

    return { members };
  },
);
