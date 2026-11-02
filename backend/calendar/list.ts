import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { CalendarEvent } from "./types";
import { eventVisibility, VISIBILITY_JOINS } from "./visibility";

interface ListEventsRequest {
  user_id?: Query<string>;
  /** WC/CC only: show this watch's watch calendar instead of their own. */
  watch?: Query<string>;
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

    let query = `
      SELECT ce.*, canceller.name AS cancelled_by_name, changer.name AS changed_by_name
      FROM calendar_events ce
      ${VISIBILITY_JOINS}
      LEFT JOIN users canceller ON canceller.id = ce.cancelled_by
      LEFT JOIN users changer ON changer.id = ce.changed_by
    `;
    let countQuery = `
      SELECT COUNT(*) as count FROM calendar_events ce
      ${VISIBILITY_JOINS}
    `;

    // A WC/CC can look at another watch's calendar by passing `watch` (they
    // can add to it and change it too — things move while a watch is off).
    const caller = await db.queryRow<{ watch_unit: string | null }>`
      SELECT watch_unit FROM users WHERE id = ${auth.userID}
    `;
    const isManager = auth.role === "WC" || auth.role === "CC";
    const showWatch = isManager && req.watch ? req.watch : caller?.watch_unit;
    const visibility = eventVisibility(auth.userID, showWatch, 1);
    const params: any[] = [...visibility.params];
    const conditions: string[] = [...visibility.conditions];
    let paramIndex = visibility.nextParam;

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
