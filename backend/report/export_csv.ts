import { api, APIError } from "encore.dev/api";
import db from "../db";
import { logActivity } from "../logging/logger";

interface ExportCsvRequest {
  table: string;
  user_id: string;
}

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
  { expose: true, method: "GET", path: "/reports/export/:table" },
  async ({ table, user_id }) => {
    if (!ALLOWED_TABLES.includes(table)) {
      throw APIError.invalidArgument("invalid table name");
    }

    const rows = await db.rawQueryAll(`SELECT * FROM ${table}`);

    if (rows.length === 0) {
      return { csv: "" };
    }

    const headers = Object.keys(rows[0]);
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
      user_id: user_id,
      action: "export_csv",
      entity_type: "report",
      entity_id: table,
      details: { table, row_count: rows.length },
    });

    return { csv: csvRows.join("\n") };
  }
);
