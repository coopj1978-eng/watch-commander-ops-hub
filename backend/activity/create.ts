import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { ActivityRecord, CreateActivityRequest } from "./types";

// POST /activities
// Creates a single activity record (hydrant inspection or community engagement).
// HFSV records should be bulk-seeded via POST /activities/seed-hfsv instead.
export const create = api<CreateActivityRequest, ActivityRecord>(
  { auth: true, expose: true, method: "POST", path: "/activities" },
  async (req) => {
    const auth = getAuthData()!;

    // Calculate sort_order as max + 1 for this type/watch/year/quarter
    const maxRow = await db.rawQueryRow<{ m: number }>(
      `SELECT COALESCE(MAX(sort_order), 0) AS m
       FROM activity_records
       WHERE type = $1 AND watch = $2 AND financial_year = $3 AND quarter = $4`,
      req.type, req.watch, req.financial_year, req.quarter
    );
    const sort_order = (maxRow?.m ?? 0) + 1;

    const row = await db.rawQueryRow<ActivityRecord>(
      `INSERT INTO activity_records
         (type, watch, financial_year, quarter, item_number, title, address,
          engagement_date, details, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      req.type,
      req.watch,
      req.financial_year,
      req.quarter,
      req.item_number ?? null,
      req.title ?? "",
      req.address ?? null,
      req.engagement_date ?? null,
      req.details ?? null,
      sort_order,
      auth.userID
    );

    if (!row) throw new Error("Failed to create activity record");
    return row;
  }
);
