import { api, APIError } from "encore.dev/api";
import db from "../db";
import type {
  UpdateReportRequest,
  UpdateReportResponse,
  QuarterlyReport,
  QuarterlyReportItem,
  QuarterlyReportCustomItem,
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

export const updateReport = api<{ id: number } & UpdateReportRequest, UpdateReportResponse>(
  { auth: true, expose: true, method: "PUT", path: "/quarterly-reports/:id" },
  async (req) => {
    const existing = await db.queryRow<DBReport>`
      SELECT * FROM quarterly_reports WHERE id = ${req.id}
    `;
    if (!existing) throw APIError.notFound("quarterly report not found");

    const newNotes = req.notes !== undefined ? req.notes : existing.notes;
    const newStatus = req.status !== undefined ? req.status : existing.status;

    const updated = await db.queryRow<DBReport>`
      UPDATE quarterly_reports
      SET
        notes = ${newNotes ?? null},
        status = ${newStatus},
        updated_at = NOW()
      WHERE id = ${req.id}
      RETURNING *
    `;
    if (!updated) throw APIError.internal("failed to update report");

    const itemRows = await db.queryAll<DBItem>`
      SELECT * FROM quarterly_report_items
      WHERE report_id = ${req.id}
      ORDER BY sort_order ASC
    `;
    const customRows = await db.queryAll<DBCustomItem>`
      SELECT * FROM quarterly_report_custom_items
      WHERE report_id = ${req.id}
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

    const report: QuarterlyReport = {
      id: updated.id,
      station_name: updated.station_name,
      watch: updated.watch,
      watch_commander_name: updated.watch_commander_name,
      quarter: updated.quarter,
      financial_year: updated.financial_year,
      notes: updated.notes ?? undefined,
      status: updated.status as "draft" | "submitted",
      created_by: updated.created_by,
      created_at: toISO(updated.created_at),
      updated_at: toISO(updated.updated_at),
      items,
      custom_items,
    };

    return { report };
  }
);
