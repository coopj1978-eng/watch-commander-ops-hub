import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
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
  { auth: true, expose: true, method: "GET", path: "/calendar/events" },
  async (req) => {
    const auth = getAuthData()!;
    const limit = req.limit || 100;
    const offset = req.offset || 0;

    let query = `
      SELECT ce.* FROM calendar_events ce
      LEFT JOIN notes n ON ce.id = n.calendar_event_id
    `;
    let countQuery = `
      SELECT COUNT(*) as count FROM calendar_events ce
      LEFT JOIN notes n ON ce.id = n.calendar_event_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    const visibilityCondition = `
      (ce.event_type != 'reminder' OR 
       n.created_by_user_id = $${paramIndex} OR 
       n.reminder_recipient_user_id = $${paramIndex} OR
       $${paramIndex} = ANY(ce.visible_to_user_ids))
    `;
    conditions.push(visibilityCondition);
    params.push(auth.userID);
    paramIndex++;

    if (req.user_id !== undefined) {
      conditions.push(`(ce.user_id = $${paramIndex} OR ce.is_watch_event = true)`);
      params.push(req.user_id);
      paramIndex++;
    }
    if (req.is_watch_event !== undefined) {
      conditions.push(`ce.is_watch_event = $${paramIndex}`);
      params.push(req.is_watch_event);
      paramIndex++;
    }
    if (req.start_date) {
      conditions.push(`ce.end_time >= $${paramIndex}`);
      params.push(req.start_date);
      paramIndex++;
    }
    if (req.end_date) {
      conditions.push(`ce.start_time <= $${paramIndex}`);
      params.push(req.end_date);
      paramIndex++;
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY ce.start_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
