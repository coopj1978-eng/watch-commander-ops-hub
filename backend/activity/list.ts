import { api } from "encore.dev/api";
import db from "../db";
import type {
  ActivityRecord,
  ListActivitiesRequest,
  ListActivitiesResponse,
} from "./types";

// GET /activities
// Returns activity records filtered by type / watch / financial_year / quarter.
export const list = api<ListActivitiesRequest, ListActivitiesResponse>(
  { auth: true, expose: true, method: "GET", path: "/activities" },
  async (req) => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (req.type)           { conditions.push(`type = $${idx++}`);           values.push(req.type); }
    if (req.watch)          { conditions.push(`watch = $${idx++}`);          values.push(req.watch); }
    if (req.financial_year) { conditions.push(`financial_year = $${idx++}`); values.push(req.financial_year); }
    if (req.quarter)        { conditions.push(`quarter = $${idx++}`);        values.push(req.quarter); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const items = await db.rawQueryAll<ActivityRecord>(
      `SELECT * FROM activity_records ${where}
       ORDER BY type, COALESCE(item_number, sort_order), id`,
      ...values
    );

    const total_completed = items.filter(i => i.completed).length;

    return { items, total_completed, total: items.length };
  }
);
