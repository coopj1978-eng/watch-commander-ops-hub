import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { CopyPreviousRequest, ListCrewingResponse, CrewingEntry } from "./types";

// POST /crewing/copy-previous
// Copies crewing from the most recent previous shift of the same type for this watch.
// Change-of-shift (external) entries are NOT copied — they're specific to their shift.
// Any existing crewing for the target date is replaced.
export const copyPrevious = api<CopyPreviousRequest, ListCrewingResponse>(
  { auth: true, expose: true, method: "POST", path: "/crewing/copy-previous" },
  async (req) => {
    const auth = getAuthData()!;

    // Find the most recent shift_date before req.shift_date for this watch + shift_type
    const latestRow = await db.rawQueryRow<{ shift_date: string }>(
      `SELECT shift_date::text
       FROM shift_crewing
       WHERE watch = $1 AND shift_type = $2 AND shift_date < $3::date
       ORDER BY shift_date DESC
       LIMIT 1`,
      req.watch, req.shift_type, req.shift_date
    );

    if (!latestRow) {
      return { entries: [] };
    }

    const prevEntries = await db.rawQueryAll<{
      appliance: string;
      user_id: string | null;
      crew_role: string;
    }>(
      `SELECT appliance, user_id, crew_role
       FROM shift_crewing
       WHERE watch = $1 AND shift_type = $2 AND shift_date = $3::date
         AND is_change_of_shift = FALSE
         AND user_id IS NOT NULL`,
      req.watch, req.shift_type, latestRow.shift_date
    );

    // Clear existing crewing for target date/shift
    await db.rawQueryAll(
      `DELETE FROM shift_crewing WHERE watch = $1 AND shift_date = $2::date AND shift_type = $3`,
      req.watch, req.shift_date, req.shift_type
    );

    // Re-insert regular (non-CoS) entries for the new date
    for (const entry of prevEntries) {
      await db.rawQueryAll(
        `INSERT INTO shift_crewing
           (watch, shift_date, shift_type, appliance, user_id, crew_role,
            is_change_of_shift, created_by)
         VALUES ($1, $2::date, $3, $4, $5, $6, FALSE, $7)`,
        req.watch, req.shift_date, req.shift_type,
        entry.appliance, entry.user_id, entry.crew_role, auth.userID
      );
    }

    // Return full crewing for the target date
    const entries = await db.rawQueryAll<CrewingEntry>(
      `SELECT
         sc.id, sc.watch, sc.shift_date::text, sc.shift_type, sc.appliance,
         sc.user_id, u.name AS user_name, u.role AS user_system_role, u.rank AS user_rank,
         sc.external_name, sc.crew_role, sc.is_change_of_shift, sc.notes, sc.created_at::text
       FROM shift_crewing sc
       LEFT JOIN users u ON sc.user_id = u.id
       WHERE sc.watch = $1 AND sc.shift_date = $2::date AND sc.shift_type = $3
       ORDER BY sc.appliance,
         CASE sc.crew_role
           WHEN 'oic'    THEN 1 WHEN 'driver' THEN 2 WHEN 'ba'     THEN 3
           WHEN 'baeco'  THEN 4 WHEN 'ff'     THEN 5 ELSE 6
         END, sc.created_at`,
      req.watch, req.shift_date, req.shift_type
    );

    return { entries };
  }
);
