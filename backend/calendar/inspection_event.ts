import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CalendarVisibility } from "./types";

export type InspectionSourceType = "hfsv" | "hydrant" | "multistory" | "operational" | "care_home";

export interface CreateInspectionEventRequest {
  source_type: InspectionSourceType | null;
  source_id: number | null;
  title: string;
  location?: string;
  start_time: Date;
  end_time: Date;
  calendar_visibility: CalendarVisibility;
  watch: string;
  color?: string;
  assigned_by: string;
  assigned_to?: string;
  due_date: Date;
}

export interface CreateInspectionEventResponse {
  calendar_event_id: number;
  task_id: number;
}

export const createInspectionEvent = api<CreateInspectionEventRequest, CreateInspectionEventResponse>(
  { auth: true, expose: true, method: "POST", path: "/calendar/inspection-event" },
  async (req) => {
    const auth = getAuthData()!;

    const categoryMap: Record<string, string> = {
      hfsv: "HFSV",
      hydrant: "Inspection",
      multistory: "Inspection",
      operational: "Inspection",
      care_home: "Inspection",
    };
    const taskCategory = req.source_type ? categoryMap[req.source_type] : "Other";

    // 1. Create calendar event
    const calEvent = await db.rawQueryRow<{ id: number }>(
      `INSERT INTO calendar_events (title, event_type, calendar_visibility, start_time, end_time, all_day, is_watch_event, location, color, created_by, watch, source_type, source_id)
       VALUES ($1, 'inspection', $2, $3, $4, false, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      req.title,
      req.calendar_visibility,
      req.start_time,
      req.end_time,
      req.calendar_visibility === "watch",
      req.location ?? null,
      req.color ?? "#f97316",
      auth.userID,
      req.watch,
      req.source_type ?? null,
      req.source_id ?? null
    );
    if (!calEvent) throw new Error("Failed to create calendar event");

    // 2. Create linked task
    const task = await db.rawQueryRow<{ id: number }>(
      `INSERT INTO tasks (title, category, assigned_to_user_id, assigned_by, status, priority, due_at, source_type, source_id, calendar_event_id)
       VALUES ($1, $2, $3, $4, 'NotStarted', 'Med', $5, $6, $7, $8)
       RETURNING id`,
      req.title,
      taskCategory,
      req.assigned_to ?? auth.userID,
      req.assigned_by,
      req.due_date,
      req.source_type ?? null,
      req.source_id ?? null,
      calEvent.id
    );
    if (!task) throw new Error("Failed to create task");

    // 3. For HFSV: persist address back to the slot record
    if (req.source_type === "hfsv" && req.source_id && req.location) {
      await db.rawQueryRow(
        `UPDATE activity_records SET address = $1, title = COALESCE(NULLIF(title,''), $1), updated_at = NOW() WHERE id = $2`,
        req.location,
        req.source_id
      );
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_inspection_event",
      entity_type: "calendar_event",
      entity_id: calEvent.id.toString(),
      details: { source_type: req.source_type, source_id: req.source_id, title: req.title },
    });

    return { calendar_event_id: calEvent.id, task_id: task.id };
  }
);
