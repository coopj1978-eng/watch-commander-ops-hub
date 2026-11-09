import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { canLogActivity } from "../lib/activityAccess";
import db, { type SQLPrimitive } from "../db";
import type { ActivityRecord, UpdateActivityRequest } from "./types";

// PATCH /activities/:id
// Updates editable fields (title, address, engagement_date, details, is_tap).
export const update = api<{ id: number } & UpdateActivityRequest, ActivityRecord>(
  { auth: true, expose: true, method: "PATCH", path: "/activities/:id" },
  async (req) => {
    const { id, ...fields } = req;
    // WCs and CCs log targets; anyone fills in their own watch's HFSV visits.
    const current = await db.rawQueryRow<{ type: string; watch: string }>(
      `SELECT type, watch FROM activity_records WHERE id = $1`,
      id
    );
    if (!current) throw APIError.notFound("activity record not found");
    if (!canLogActivity(getAuthData()!, current)) {
      throw APIError.permissionDenied("Only a WC or CC can change this. You can fill in your own watch's home fire safety visits.");
    }

    const setClauses: string[] = [];
    const values: SQLPrimitive[] = [];
    let idx = 1;

    if (fields.title !== undefined)           { setClauses.push(`title = $${idx++}`);           values.push(fields.title); }
    if (fields.address !== undefined)         { setClauses.push(`address = $${idx++}`);         values.push(fields.address); }
    if (fields.engagement_date !== undefined) { setClauses.push(`engagement_date = $${idx++}`); values.push(fields.engagement_date); }
    if (fields.details !== undefined)         { setClauses.push(`details = $${idx++}`);         values.push(fields.details); }
    if (fields.is_tap !== undefined)          { setClauses.push(`is_tap = $${idx++}`);          values.push(fields.is_tap); }

    if (setClauses.length === 0) throw APIError.invalidArgument("no fields to update");

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const row = await db.rawQueryRow<ActivityRecord>(
      `UPDATE activity_records SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
      ...values
    );

    if (!row) throw APIError.notFound("activity record not found");
    return row;
  }
);
