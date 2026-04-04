import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { CreateDetachmentRequest, Detachment } from "./types";

// POST /detachments — record a firefighter detachment event
export const create = api<CreateDetachmentRequest, Detachment>(
  { auth: true, expose: true, method: "POST", path: "/detachments" },
  async (req) => {
    const auth = getAuthData()!;

    const inserted = await db.rawQueryRow<{ id: number }>(
      `INSERT INTO detachments
         (firefighter_id, firefighter_name, home_watch, to_station,
          detachment_date, reason, notes, recorded_by_user_id)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8)
       RETURNING id`,
      req.firefighter_id,
      req.firefighter_name,
      req.home_watch,
      req.to_station,
      req.detachment_date,
      req.reason    ?? null,
      req.notes     ?? null,
      auth.userID,
    );

    const det = await db.rawQueryRow<{
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
       FROM detachments WHERE id = $1`,
      inserted!.id,
    );

    return {
      ...det!,
      reason: det!.reason ?? undefined,
      notes:  det!.notes  ?? undefined,
    };
  },
);
