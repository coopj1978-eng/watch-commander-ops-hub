import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requirePermission, Permission } from "../auth/rbac";

interface ExportTableCSVRequest {
  table: string;
}

interface ExportTableCSVResponse {
  csv: string;
  filename: string;
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCSV(rows: any[]): string {
  if (rows.length === 0) return "";
  
  const headers = Object.keys(rows[0]);
  const headerRow = headers.map(escapeCSV).join(",");
  
  const dataRows = rows.map(row => 
    headers.map(header => escapeCSV(row[header])).join(",")
  );
  
  return [headerRow, ...dataRows].join("\n");
}

export const exportTableCSV = api<ExportTableCSVRequest, ExportTableCSVResponse>(
  { auth: true, expose: true, method: "POST", path: "/report/export" },
  async (req) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.EXPORT_REPORTS);

    let query: string;
    let filename: string;

    switch (req.table) {
      case "users":
        query = "SELECT id, email, name, role, watch_unit, rank, last_login_at, created_at FROM users ORDER BY name";
        filename = "users.csv";
        break;
      case "firefighter_profiles":
        query = `SELECT 
          fp.id, fp.user_id, u.name as user_name, fp.service_number, fp.station, fp.shift, 
          fp.rank, fp.hire_date, fp.phone, fp.emergency_contact_name, fp.emergency_contact_phone,
          fp.driver_lgv, fp.driver_erd, fp.prps, fp.ba, 
          fp.last_one_to_one_date, fp.next_one_to_one_date
          FROM firefighter_profiles fp
          LEFT JOIN users u ON fp.user_id = u.id
          ORDER BY u.name`;
        filename = "firefighter_profiles.csv";
        break;
      case "tasks":
        query = `SELECT 
          t.id, t.title, t.description, t.category, t.status, t.priority,
          t.due_at, t.assigned_to_user_id, u.name as assigned_to_name,
          t.completed_at, t.created_at
          FROM tasks t
          LEFT JOIN users u ON t.assigned_to_user_id = u.id
          ORDER BY t.created_at DESC`;
        filename = "tasks.csv";
        break;
      case "inspections":
        query = "SELECT * FROM inspections ORDER BY scheduled_for DESC";
        filename = "inspections.csv";
        break;
      case "absences":
        query = `SELECT 
          a.id, a.user_id, u.name as user_name, a.type, a.start_date, a.end_date,
          a.days_count, a.reason, a.status, a.approved_by, a.created_at
          FROM absences a
          LEFT JOIN users u ON a.user_id = u.id
          ORDER BY a.start_date DESC`;
        filename = "absences.csv";
        break;
      case "calendar_events":
        query = `SELECT 
          ce.id, ce.title, ce.description, ce.start_time, ce.end_time,
          ce.all_day, ce.created_by, u.name as created_by_name, ce.created_at
          FROM calendar_events ce
          LEFT JOIN users u ON ce.created_by = u.id
          ORDER BY ce.start_time`;
        filename = "calendar_events.csv";
        break;
      case "targets":
        query = "SELECT * FROM targets ORDER BY target_date";
        filename = "targets.csv";
        break;
      case "policy_documents":
        query = "SELECT id, title, file_key, category, uploaded_by, uploaded_at FROM policy_documents ORDER BY uploaded_at DESC";
        filename = "policy_documents.csv";
        break;
      default:
        throw new Error(`Invalid table: ${req.table}`);
    }

    const rows = await db.rawQueryAll<any>(query);
    const csv = rowsToCSV(rows);

    return { csv, filename };
  }
);
