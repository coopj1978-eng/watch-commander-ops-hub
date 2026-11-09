import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { canLogActivity } from "../lib/activityAccess";
import db from "../db";
import type { SeedHfsvRequest, SeedHfsvResponse } from "./types";

// POST /activities/seed-hfsv
// Creates 36 numbered HFSV placeholders for a given watch/financial_year/quarter.
// Safe to re-run: skips rows where item_number already exists for that slot.
export const seedHfsv = api<SeedHfsvRequest, SeedHfsvResponse>(
  { auth: true, expose: true, method: "POST", path: "/activities/seed-hfsv" },
  async (req) => {
    const auth = getAuthData()!;
    // WCs and CCs; anyone can set up their own watch's visit slots.
    if (!canLogActivity(auth, { type: "hfsv", watch: req.watch })) {
      throw APIError.permissionDenied("You can only set up your own watch's home fire safety visits.");
    }
    let created = 0;
    let skipped = 0;

    for (let n = 1; n <= 36; n++) {
      // Check if already exists
      const existing = await db.rawQueryRow<{ id: number }>(
        `SELECT id FROM activity_records
         WHERE type = 'hfsv' AND watch = $1 AND financial_year = $2
           AND quarter = $3 AND item_number = $4`,
        req.watch, req.financial_year, req.quarter, n
      );

      if (existing) {
        skipped++;
        continue;
      }

      await db.rawQueryRow<{ id: number }>(
        `INSERT INTO activity_records
           (type, watch, financial_year, quarter, item_number, title, sort_order, created_by)
         VALUES ('hfsv', $1, $2, $3, $4, '', $4, $5)
         RETURNING id`,
        req.watch, req.financial_year, req.quarter, n, auth.userID
      );
      created++;
    }

    return { created, skipped };
  }
);
