import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { CalendarEvent } from "./types";
import type { Task } from "../task/types";
import type { Inspection } from "../inspection/types";
import { eventVisibility, VISIBILITY_JOINS } from "./visibility";

// Always the caller's own calendar: there is no user_id, so nobody can
// download another person's events, tasks or inspections.
interface ExportICSRequest {
  start_date?: Query<string>;
  end_date?: Query<string>;
}

interface ExportICSResponse {
  content: string;
  filename: string;
}

// Named columns, not `SELECT *`: pooled connections cache a `*` query's
// result shape (see note/columns.ts).
type ExportEvent = Pick<
  CalendarEvent,
  "id" | "title" | "description" | "location" | "event_type" | "start_time" | "end_time" | "is_watch_event" | "cancelled_at"
>;
type ExportTask = Pick<Task, "id" | "title" | "description" | "category" | "priority" | "status" | "due_at">;
type ExportInspection = Pick<Inspection, "id" | "type" | "address" | "notes" | "priority" | "scheduled_for">;

export const exportICS = api<ExportICSRequest, ExportICSResponse>(
  { expose: true, method: "GET", path: "/calendar/export.ics", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const userId = auth.userID;

    const startDate = req.start_date || new Date().toISOString();
    const endDate = req.end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    // What the Calendar page shows: your own events plus station and watch
    // events, under the calendar list's rules (reminders only to their
    // writer, watch events only to your watch, personal only to the owner).
    const caller = await db.queryRow<{ watch_unit: string | null }>`
      SELECT watch_unit FROM users WHERE id = ${userId}
    `;
    const visibility = eventVisibility(userId, caller?.watch_unit, 1);
    const p = visibility.nextParam;
    const events = await db.rawQueryAll<ExportEvent>(
      `
      SELECT ce.id, ce.title, ce.description, ce.location, ce.event_type,
             ce.start_time, ce.end_time, ce.is_watch_event, ce.cancelled_at
      FROM calendar_events ce
      ${VISIBILITY_JOINS}
      WHERE ${visibility.conditions.join(" AND ")}
        AND (ce.user_id = $${p} OR ce.is_watch_event = true)
        AND ce.start_time >= $${p + 1}
        AND ce.end_time <= $${p + 2}
      ORDER BY ce.start_time ASC
    `,
      ...visibility.params,
      userId,
      startDate,
      endDate
    );

    const tasks = await db.queryAll<ExportTask>`
      SELECT id, title, description, category, priority, status, due_at FROM tasks
      WHERE assigned_to_user_id = ${userId}
        AND due_at IS NOT NULL
        AND due_at >= ${startDate}
        AND due_at <= ${endDate}
      ORDER BY due_at ASC
    `;

    const inspections = await db.queryAll<ExportInspection>`
      SELECT id, type, address, notes, priority, scheduled_for FROM inspections
      WHERE ${userId} = ANY(assigned_crew_ids)
        AND scheduled_for >= ${startDate}
        AND scheduled_for <= ${endDate}
      ORDER BY scheduled_for ASC
    `;

    const lines: string[] = [];

    lines.push("BEGIN:VCALENDAR");
    lines.push("VERSION:2.0");
    lines.push("PRODID:-//Watch Commander//Calendar//EN");
    lines.push("CALSCALE:GREGORIAN");
    lines.push("METHOD:PUBLISH");
    lines.push(`X-WR-CALNAME:Watch Commander - ${userId}`);
    lines.push("X-WR-TIMEZONE:UTC");

    const formatDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const escapeText = (text: string): string => {
      return text
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
    };

    for (const event of events) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:event-${event.id}@watchcommander.local`);
      lines.push(`DTSTAMP:${formatDate(new Date())}`);
      lines.push(`DTSTART:${formatDate(new Date(event.start_time))}`);
      lines.push(`DTEND:${formatDate(new Date(event.end_time))}`);
      lines.push(`SUMMARY:${escapeText(event.title)}`);
      if (event.description) {
        lines.push(`DESCRIPTION:${escapeText(event.description)}`);
      }
      if (event.location) {
        lines.push(`LOCATION:${escapeText(event.location)}`);
      }
      lines.push(`CATEGORIES:${event.event_type.toUpperCase()}`);
      // Struck through on the calendar (not deleted) → cancelled in the file.
      if (event.cancelled_at) {
        lines.push("STATUS:CANCELLED");
      } else if (event.is_watch_event) {
        lines.push("STATUS:CONFIRMED");
      }
      lines.push("END:VEVENT");
    }

    for (const task of tasks) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:task-${task.id}@watchcommander.local`);
      lines.push(`DTSTAMP:${formatDate(new Date())}`);
      lines.push(`DTSTART:${formatDate(new Date(task.due_at!))}`);
      lines.push(`DTEND:${formatDate(new Date(new Date(task.due_at!).getTime() + 60 * 60 * 1000))}`);
      lines.push(`SUMMARY:[TASK] ${escapeText(task.title)}`);
      if (task.description) {
        lines.push(`DESCRIPTION:${escapeText(task.description)}`);
      }
      lines.push(`CATEGORIES:TASK,${task.category.toUpperCase()}`);
      lines.push(`PRIORITY:${task.priority === "High" ? "1" : task.priority === "Med" ? "5" : "9"}`);
      lines.push(`STATUS:${task.status === "Done" ? "COMPLETED" : "NEEDS-ACTION"}`);
      lines.push("END:VEVENT");
    }

    for (const inspection of inspections) {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:inspection-${inspection.id}@watchcommander.local`);
      lines.push(`DTSTAMP:${formatDate(new Date())}`);
      lines.push(`DTSTART:${formatDate(new Date(inspection.scheduled_for))}`);
      lines.push(`DTEND:${formatDate(new Date(new Date(inspection.scheduled_for).getTime() + 2 * 60 * 60 * 1000))}`);
      lines.push(`SUMMARY:[INSPECTION] ${escapeText(inspection.type)} - ${escapeText(inspection.address)}`);
      if (inspection.notes) {
        lines.push(`DESCRIPTION:${escapeText(inspection.notes)}`);
      }
      lines.push(`LOCATION:${escapeText(inspection.address)}`);
      lines.push(`CATEGORIES:INSPECTION,${inspection.type.toUpperCase()}`);
      lines.push(`PRIORITY:${inspection.priority === "High" ? "1" : inspection.priority === "Med" ? "5" : "9"}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const content = lines.join("\r\n");
    const filename = `watchcommander-calendar-${userId}-${new Date().toISOString().split("T")[0]}.ics`;

    return {
      content,
      filename,
    };
  }
);
