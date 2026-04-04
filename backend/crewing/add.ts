import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { AddCrewingRequest, CrewingEntry } from "./types";

// POST /crewing — add a crew member to an appliance for a shift
export const add = api<AddCrewingRequest, CrewingEntry>(
  { auth: true, expose: true, method: "POST", path: "/crewing" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.user_id && !req.external_name) {
      throw new Error("Either user_id or external_name is required");
    }

    const inserted = await db.rawQueryRow<{ id: number }>(
      `INSERT INTO shift_crewing
         (watch, shift_date, shift_type, appliance, user_id, external_name,
          crew_role, is_change_of_shift, notes, created_by)
       VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      req.watch,
      req.shift_date,
      req.shift_type,
      req.appliance,
      req.user_id   ?? null,
      req.external_name ?? null,
      req.crew_role,
      req.is_change_of_shift ?? false,
      req.notes     ?? null,
      auth.userID
    );

    // Return with user details joined
    const entry = await db.rawQueryRow<CrewingEntry>(
      `SELECT
         sc.id, sc.watch, sc.shift_date::text, sc.shift_type, sc.appliance,
         sc.user_id, u.name AS user_name, u.role AS user_system_role, u.rank AS user_rank,
         sc.external_name, sc.crew_role, sc.is_change_of_shift, sc.notes, sc.created_at::text
       FROM shift_crewing sc
       LEFT JOIN users u ON sc.user_id = u.id
       WHERE sc.id = $1`,
      inserted!.id
    );

    return entry!;
  }
);
