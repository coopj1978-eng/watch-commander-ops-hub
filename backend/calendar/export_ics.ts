import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { CalendarEvent } from "./types";
import type { Task } from "../task/types";
import type { Inspection } from "../inspection/types";

interface ExportICSRequest {
  user_id?: Query<string>;
  start_date?: Query<string>;
  end_date?: Query<string>;
}

interface ExportICSResponse {
  content: string;
  filename: string;
}

export const exportICS = api<ExportICSRequest, ExportICSResponse>(
  { expose: true, method: "GET", path: "/calendar/export.ics", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const userId = req.user_id || auth.userID;

    const startDate = req.start_date || new Date().toISOString();
    const endDate = req.end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const events = await db.query<CalendarEvent>`
      SELECT * FROM calendar_events
      WHERE (user_id = ${userId} OR is_watch_event = true)
        AND start_time >= ${startDate}
        AND end_time <= ${endDate}
      ORDER BY start_time ASC
    `;

    const tasks = await db.query<Task>`
      SELECT * FROM tasks
      WHERE assigned_to_user_id = ${userId}
        AND due_at IS NOT NULL
        AND due_at >= ${startDate}
        AND due_at <= ${endDate}
      ORDER BY due_at ASC
    `;

    const inspections = await db.query<Inspection>`
      SELECT * FROM inspections
      WHERE assigned_to = ${userId}
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

    for await (const event of events) {
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
      if (event.is_watch_event) {
        lines.push("STATUS:CONFIRMED");
      }
      lines.push("END:VEVENT");
    }

    for await (const task of tasks) {
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

    for await (const inspection of inspections) {
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
