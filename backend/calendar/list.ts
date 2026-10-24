import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { CalendarEvent } from "./types";

interface ListEventsRequest {
  user_id?: Query<string>;
  is_watch_event?: Query<boolean>;
  calendar_visibility?: Query<string>;
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

    // creator join: legacy watch events have no `watch` stored, so fall
    // back to the creator's watch when scoping them below.
    let query = `
      SELECT ce.* FROM calendar_events ce
      LEFT JOIN notes n ON ce.id = n.calendar_event_id
      LEFT JOIN users creator ON creator.id = ce.created_by
    `;
    let countQuery = `
      SELECT COUNT(*) as count FROM calendar_events ce
      LEFT JOIN notes n ON ce.id = n.calendar_event_id
      LEFT JOIN users creator ON creator.id = ce.created_by
    `;
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    // Reminders (e.g. a note's follow-up, which carries part of the note)
    // are private to whoever wrote them.
    const visibilityCondition = `
      (ce.event_type != 'reminder' OR
       COALESCE(n.created_by_user_id, ce.created_by) = $${paramIndex})
    `;
    conditions.push(visibilityCondition);
    params.push(auth.userID);
    paramIndex++;

    // Watch-calendar events are only visible to that watch. Station-wide and
    // personal events are unaffected. Callers with no watch see all (admin).
    const caller = await db.queryRow<{ watch_unit: string | null }>`
      SELECT watch_unit FROM users WHERE id = ${auth.userID}
    `;
    if (caller?.watch_unit) {
      conditions.push(
        `(ce.calendar_visibility <> 'watch' OR LOWER(COALESCE(ce.watch, creator.watch_unit, '')) = LOWER($${paramIndex}))`
      );
      params.push(caller.watch_unit);
      paramIndex++;
    }

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
    if (req.calendar_visibility !== undefined) {
      conditions.push(`ce.calendar_visibility = $${paramIndex}`);
      params.push(req.calendar_visibility);
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
