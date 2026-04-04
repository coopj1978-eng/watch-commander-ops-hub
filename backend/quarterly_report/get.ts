import { api, APIError } from "encore.dev/api";
import db from "../db";
import type {
  GetReportResponse,
  QuarterlyReport,
  QuarterlyReportCustomItem,
  QuarterlyReportItem,
} from "./types";

interface DBReport {
  id: number;
  station_name: string;
  watch: string;
  watch_commander_name: string;
  quarter: number;
  financial_year: number;
  notes: string | null;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface DBItem {
  id: number;
  report_id: number;
  kpi_code: string;
  description: string;
  target_text: string;
  row_color: string;
  category: string;
  sort_order: number;
  met: boolean;
  actual_value: string | null;
  rationale: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DBCustomItem {
  id: number;
  report_id: number;
  description: string;
  target_text: string | null;
  met: boolean;
  rationale: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

function toISO(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

export const get = api<{ id: number }, GetReportResponse>(
  { auth: true, expose: true, method: "GET", path: "/quarterly-reports/:id" },
  async ({ id }) => {
    const report = await db.queryRow<DBReport>`
      SELECT * FROM quarterly_reports WHERE id = ${id}
    `;
    if (!report) throw APIError.notFound("quarterly report not found");

    const itemRows = await db.queryAll<DBItem>`
      SELECT * FROM quarterly_report_items
      WHERE report_id = ${id}
      ORDER BY sort_order ASC
    `;

    const customRows = await db.queryAll<DBCustomItem>`
      SELECT * FROM quarterly_report_custom_items
      WHERE report_id = ${id}
      ORDER BY sort_order ASC, id ASC
    `;

    const items: QuarterlyReportItem[] = itemRows.map((r) => ({
      id: r.id,
      report_id: r.report_id,
      kpi_code: r.kpi_code,
      description: r.description,
      target_text: r.target_text,
      row_color: r.row_color,
      category: r.category,
      sort_order: r.sort_order,
      met: r.met,
      actual_value: r.actual_value ?? undefined,
      rationale: r.rationale ?? undefined,
      created_at: toISO(r.created_at),
      updated_at: toISO(r.updated_at),
    }));

    const custom_items: QuarterlyReportCustomItem[] = customRows.map((r) => ({
      id: r.id,
      report_id: r.report_id,
      description: r.description,
      target_text: r.target_text ?? undefined,
      met: r.met,
      rationale: r.rationale ?? undefined,
      sort_order: r.sort_order,
      created_at: toISO(r.created_at),
      updated_at: toISO(r.updated_at),
    }));

    const result: QuarterlyReport = {
      id: report.id,
      station_name: report.station_name,
      watch: report.watch,
      watch_commander_name: report.watch_commander_name,
      quarter: report.quarter,
      financial_year: report.financial_year,
      notes: report.notes ?? undefined,
      status: report.status as "draft" | "submitted",
      created_by: report.created_by,
      created_at: toISO(report.created_at),
      updated_at: toISO(report.updated_at),
      items,
      custom_items,
    };

    return { report: result };
  }
);
