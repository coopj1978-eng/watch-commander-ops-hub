import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { ActivityRecord, UpdateActivityRequest } from "./types";

// PATCH /activities/:id
// Updates editable fields (title, address, engagement_date, details).
export const update = api<{ id: number } & UpdateActivityRequest, ActivityRecord>(
  { auth: true, expose: true, method: "PATCH", path: "/activities/:id" },
  async (req) => {
    const { id, ...fields } = req;

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.title !== undefined)           { setClauses.push(`title = $${idx++}`);           values.push(fields.title); }
    if (fields.address !== undefined)         { setClauses.push(`address = $${idx++}`);         values.push(fields.address); }
    if (fields.engagement_date !== undefined) { setClauses.push(`engagement_date = $${idx++}`); values.push(fields.engagement_date); }
    if (fields.details !== undefined)         { setClauses.push(`details = $${idx++}`);         values.push(fields.details); }

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
