import { api } from "encore.dev/api";
import db from "../db";
import type { ListCrewingRequest, ListCrewingResponse, CrewingEntry } from "./types";

// GET /crewing — returns all crewing entries for a specific watch/date/shift
export const list = api<ListCrewingRequest, ListCrewingResponse>(
  { auth: true, expose: true, method: "GET", path: "/crewing" },
  async (req) => {
    const entries = await db.rawQueryAll<CrewingEntry>(
      `SELECT
         sc.id,
         sc.watch,
         sc.shift_date::text,
         sc.shift_type,
         sc.appliance,
         sc.user_id,
         u.name     AS user_name,
         u.role     AS user_system_role,
         u.rank     AS user_rank,
         sc.external_name,
         sc.crew_role,
         sc.is_change_of_shift,
         sc.notes,
         sc.created_at::text
       FROM shift_crewing sc
       LEFT JOIN users u ON sc.user_id = u.id
       WHERE sc.watch = $1
         AND sc.shift_date = $2::date
         AND sc.shift_type = $3
       ORDER BY
         sc.appliance,
         CASE sc.crew_role
           WHEN 'oic'    THEN 1
           WHEN 'driver' THEN 2
           WHEN 'ba'     THEN 3
           WHEN 'baeco'  THEN 4
           WHEN 'ff'     THEN 5
           ELSE 6
         END,
         sc.created_at`,
      req.watch, req.shift_date, req.shift_type
    );

    return { entries };
  }
);
