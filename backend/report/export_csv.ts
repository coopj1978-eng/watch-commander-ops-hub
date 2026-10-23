import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

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

    const rows = await db.rawQueryAll(`SELECT * FROM ${table}`);

    if (rows.length === 0) {
      return { csv: "" };
    }

    const headers = Object.keys(rows[0]).filter((h) => !SECRET_COLUMNS.has(h));
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
