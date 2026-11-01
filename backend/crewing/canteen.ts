import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requireRole } from "../auth/rbac";
import type { ShiftType } from "./types";

// Canteen duty — one or two people per shift, anyone on the watch, picked on
// the crewing board by a WC or CC. They still ride (it's an extra duty), so
// it's kept apart from shift_crewing. The rota orders the watch by how long
// since each person last did canteen, longest first — like detachments.

const MAX_PER_SHIFT = 2;

export interface CanteenDuty {
  id: number;
  watch: string;
  shift_date: string;
  shift_type: ShiftType;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

export interface CanteenShiftRequest {
  watch: string;
  shift_date: string;
  shift_type: ShiftType;
}

export interface AddCanteenRequest {
  watch: string;
  shift_date: string;
  shift_type: ShiftType;
  user_id: string;
}

export interface CanteenRotaMember {
  user_id: string;
  name: string;
  system_role: string;
  rank: string | null;
  /** Date of their last canteen (YYYY-MM-DD), null if never. */
  last_date: string | null;
  last_shift_type: string | null;
  /** Canteen shifts in the last 90 days. */
  recent_count: number;
}

const SELECT_DUTY = `
  SELECT cd.id, cd.watch, cd.shift_date::text AS shift_date, cd.shift_type, cd.user_id,
         u.name AS user_name, cd.created_at::text AS created_at
  FROM canteen_duties cd
  LEFT JOIN users u ON u.id = cd.user_id`;

// GET /canteen — who's on canteen for one shift
export const listCanteen = api<CanteenShiftRequest, { duties: CanteenDuty[] }>(
  { auth: true, expose: true, method: "GET", path: "/canteen" },
  async (req) => {
    const duties = await db.rawQueryAll<CanteenDuty>(
      `${SELECT_DUTY}
       WHERE LOWER(cd.watch) = LOWER($1) AND cd.shift_date = $2::date AND cd.shift_type = $3
       ORDER BY cd.created_at`,
      req.watch, req.shift_date, req.shift_type,
    );
    return { duties };
  },
);

// POST /canteen — put someone on canteen for a shift (WC/CC, at most two)
export const addCanteen = api<AddCanteenRequest, CanteenDuty>(
  { auth: true, expose: true, method: "POST", path: "/canteen" },
  async (req) => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");

    const count = await db.rawQueryRow<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM canteen_duties
       WHERE LOWER(watch) = LOWER($1) AND shift_date = $2::date AND shift_type = $3`,
      req.watch, req.shift_date, req.shift_type,
    );
    if ((count?.n ?? 0) >= MAX_PER_SHIFT) {
      throw APIError.failedPrecondition(`Canteen already has ${MAX_PER_SHIFT} people for this shift`);
    }

    const row = await db.rawQueryRow<{ id: number }>(
      `INSERT INTO canteen_duties (watch, shift_date, shift_type, user_id, created_by)
       VALUES ($1, $2::date, $3, $4, $5)
       ON CONFLICT (LOWER(watch), shift_date, shift_type, user_id) DO NOTHING
       RETURNING id`,
      req.watch, req.shift_date, req.shift_type, req.user_id, auth.userID,
    );
    if (!row) throw APIError.alreadyExists("Already on canteen for this shift");

    const duty = await db.rawQueryRow<CanteenDuty>(`${SELECT_DUTY} WHERE cd.id = $1`, row.id);
    return duty!;
  },
);

// DELETE /canteen/:id — take someone off canteen (WC/CC)
export const removeCanteen = api<{ id: number }, { ok: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/canteen/:id" },
  async (req) => {
    requireRole(getAuthData()!, "WC", "CC");
    const row = await db.rawQueryRow<{ id: number }>(
      `DELETE FROM canteen_duties WHERE id = $1 RETURNING id`, req.id,
    );
    if (!row) throw APIError.notFound("Canteen duty not found");
    return { ok: true };
  },
);

// GET /canteen-rota — the watch, longest since canteen first (never = top)
export const canteenRota = api<{ watch: string }, { members: CanteenRotaMember[] }>(
  { auth: true, expose: true, method: "GET", path: "/canteen-rota" },
  async (req) => {
    const members = await db.rawQueryAll<CanteenRotaMember>(
      `SELECT u.id AS user_id, u.name, u.role AS system_role, u.rank,
              last.shift_date::text AS last_date, last.shift_type AS last_shift_type,
              COALESCE(recent.n, 0)::int AS recent_count
       FROM users u
       LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT shift_date, shift_type FROM canteen_duties
         WHERE user_id = u.id ORDER BY shift_date DESC, created_at DESC LIMIT 1
       ) last ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS n FROM canteen_duties
         WHERE user_id = u.id AND shift_date >= CURRENT_DATE - 90
       ) recent ON true
       WHERE LOWER(COALESCE(u.watch_unit, fp.watch)) = LOWER($1)
         AND u.left_at IS NULL
         AND u.role IN ('WC', 'CC', 'FF')
       ORDER BY last.shift_date ASC NULLS FIRST, recent.n ASC, u.name ASC`,
      req.watch,
    );
    return { members };
  },
);

// GET /canteen-history — recent canteen duties for a watch, newest first
export const canteenHistory = api<{ watch: string; limit?: number }, { duties: CanteenDuty[] }>(
  { auth: true, expose: true, method: "GET", path: "/canteen-history" },
  async (req) => {
    const limit = Math.min(Math.max(Number(req.limit) || 40, 1), 200);
    const duties = await db.rawQueryAll<CanteenDuty>(
      `${SELECT_DUTY}
       WHERE LOWER(cd.watch) = LOWER($1)
       ORDER BY cd.shift_date DESC,
                CASE cd.shift_type WHEN '2nd Night' THEN 4 WHEN '1st Night' THEN 3 WHEN '2nd Day' THEN 2 ELSE 1 END DESC,
                cd.created_at
       LIMIT $2`,
      req.watch, limit,
    );
    return { duties };
  },
);
