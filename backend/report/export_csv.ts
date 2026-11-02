import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db, { type SQLPrimitive } from "../db";
import { absenceViewer, visibleAbsencesSql } from "../lib/absenceAccess";
import { logActivity } from "../logging/logger";
import { eventVisibility, VISIBILITY_JOINS } from "../calendar/visibility";

interface ExportCsvRequest {
  table: string;
  /** Ignored — the caller is taken from the auth token. Kept so older clients still validate. */
  user_id?: string;
}

// Credential columns must never leave the database, even for a WC export.
const SECRET_COLUMNS = new Set([
  "password_hash",
  "password_reset_token",
  "password_reset_expires",
]);

interface ExportCsvResponse {
  csv: string;
}

// Sickness totals on profiles aren't exported station-wide; a watch's own
// sickness comes out through the absences export.
// Old unattributed note fields aren't exported either (notes are private to
// their writer).
const SICKNESS_COLUMNS = new Set([
  "rolling_sick_episodes", "rolling_sick_days", "trigger_stage",
  "notes", "last_conversation_date", "last_conversation_text",
]);

const ALLOWED_TABLES = [
  "users",
  "firefighter_profiles",
  "absences",
  "tasks",
  "inspections",
  "targets",
  "policy_docs",
  "calendar_events",
  "activity_log",
];

export const exportCsv = api<ExportCsvRequest, ExportCsvResponse>(
  { auth: true, expose: true, method: "GET", path: "/reports/export/:table" },
  async ({ table }) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC" && auth.role !== "CC") {
      throw APIError.permissionDenied("Only WC or CC can export data");
    }
    if (!ALLOWED_TABLES.includes(table)) {
      throw APIError.invalidArgument("invalid table name");
    }

    // Absence records only for the caller's own watch (and themself).
    const params: SQLPrimitive[] = [];
    let from = table;
    let where = "";
    if (table === "absences") {
      where = ` WHERE ${visibleAbsencesSql(await absenceViewer(), "firefighter_id", params)}`;
    } else if (table === "calendar_events") {
      // The calendar page's own rules: no one else's reminders (a note's
      // follow-up carries part of the note) or personal entries, and watch
      // events only for your watch. Only the event's own columns come out.
      const me = await db.queryRow<{ watch_unit: string | null }>`
        SELECT watch_unit FROM users WHERE id = ${auth.userID}
      `;
      const visibility = eventVisibility(auth.userID, me?.watch_unit, 1);
      params.push(...visibility.params);
      from = `(SELECT ce.* FROM calendar_events ce ${VISIBILITY_JOINS} WHERE ${visibility.conditions.join(" AND ")}) AS visible`;
    } else if (table === "activity_log") {
      // Note entries only for whoever wrote the note.
      params.push(auth.userID);
      where = ` WHERE entity_type IS DISTINCT FROM 'note' OR user_id = $${params.length}`;
    }
    const rows = await db.rawQueryAll(`SELECT * FROM ${from}${where}`, ...params);

    if (rows.length === 0) {
      return { csv: "" };
    }

    const headers = Object.keys(rows[0]).filter(
      (h) => !SECRET_COLUMNS.has(h) && !(table === "firefighter_profiles" && SICKNESS_COLUMNS.has(h))
    );
    const csvRows = [headers.join(",")];

    for (const row of rows) {
      const values = headers.map((header) => {
        const value = row[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && value.includes(",")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (Array.isArray(value)) {
          return `"${value.join(";")}"`;
        }
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csvRows.push(values.join(","));
    }

    await logActivity({
      user_id: auth.userID,
      action: "export_csv",
      entity_type: "report",
      entity_id: table,
      details: { table, row_count: rows.length },
    });

    return { csv: csvRows.join("\n") };
  }
);
