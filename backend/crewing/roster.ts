import { api } from "encore.dev/api";
import db from "../db";
import type { RosterRequest, RosterResponse, RosterMember } from "./types";

// GET /crewing/roster
// Returns all active WC/CC/FF members for a watch, checking BOTH
// users.watch_unit AND firefighter_profiles.watch so no one is missed
// regardless of which column was populated for their account.
export const roster = api<RosterRequest, RosterResponse>(
  { auth: true, expose: true, method: "GET", path: "/crewing/roster" },
  async (req) => {
    const members = await db.rawQueryAll<RosterMember>(
      `SELECT
         u.id,
         u.name,
         u.role        AS system_role,
         u.rank,
         u.watch_unit,
         p.watch       AS profile_watch,
         COALESCE(p.ba,          false) AS ba,
         COALESCE(p.prps,        false) AS prps,
         COALESCE(p.driver_lgv,  false) AS driver_lgv,
         COALESCE(p.driver_erd,  false) AS driver_erd
       FROM users u
       LEFT JOIN firefighter_profiles p ON p.user_id = u.id
       WHERE u.left_at IS NULL
         AND u.role IN ('WC', 'CC', 'FF')
         AND (u.watch_unit = $1 OR p.watch = $1)
       ORDER BY
         CASE u.role
           WHEN 'WC' THEN 1
           WHEN 'CC' THEN 2
           ELSE 3
         END,
         u.name`,
      req.watch
    );

    return { members };
  }
);
