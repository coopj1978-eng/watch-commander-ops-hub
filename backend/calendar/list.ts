import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { CalendarEvent } from "./types";

interface ListEventsRequest {
  user_id?: Query<string>;
  is_watch_event?: Query<boolean>;
  start_date?: Query<string>;
  end_date?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListEventsResponse {
  events: CalendarEvent[];
  total: number;
}

export const list = api<ListEventsRequest, ListEventsResponse>(
  { expose: true, method: "GET", path: "/calendar/events" },
  async (req) => {
    const limit = req.limit || 100;
    const offset = req.offset || 0;

    let query = `SELECT * FROM calendar_events`;
    let countQuery = `SELECT COUNT(*) as count FROM calendar_events`;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (req.user_id !== undefined) {
      conditions.push(`(user_id = $${paramIndex} OR is_watch_event = true)`);
      params.push(req.user_id);
      paramIndex++;
    }
    if (req.is_watch_event !== undefined) {
      conditions.push(`is_watch_event = $${paramIndex}`);
      params.push(req.is_watch_event);
      paramIndex++;
    }
    if (req.start_date) {
      conditions.push(`end_time >= $${paramIndex}`);
      params.push(req.start_date);
      paramIndex++;
    }
    if (req.end_date) {
      conditions.push(`start_time <= $${paramIndex}`);
      params.push(req.end_date);
      paramIndex++;
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY start_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const events = await db.rawQueryAll<CalendarEvent>(query, ...params);
    const countParams = params.slice(0, -2);
    const countResult = await db.rawQueryRow<{ count: number }>(countQuery, ...countParams);

    return {
      events,
      total: countResult?.count || 0,
    };
  }
);
