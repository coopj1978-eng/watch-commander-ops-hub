import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type {
  CreateReportRequest,
  CreateReportResponse,
  QuarterlyReport,
  QuarterlyReportItem,
} from "./types";
import { KPI_TEMPLATE } from "./types";

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

function toISO(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

export const create = api<CreateReportRequest, CreateReportResponse>(
  { auth: true, expose: true, method: "POST", path: "/quarterly-reports" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.watch) throw APIError.invalidArgument("watch is required");
    if (!req.quarter || req.quarter < 1 || req.quarter > 4)
      throw APIError.invalidArgument("quarter must be 1–4");
    if (!req.financial_year || req.financial_year < 2020)
      throw APIError.invalidArgument("financial_year is required");
    if (!req.watch_commander_name)
      throw APIError.invalidArgument("watch_commander_name is required");

    // Look up station from profile if not supplied
    let stationName = req.station_name ?? "";
    if (!stationName) {
      const profile = await db.queryRow<{ station: string | null }>`
        SELECT station FROM firefighter_profiles WHERE user_id = ${auth.userID}
      `;
      stationName = profile?.station ?? "";
    }

    // Check for existing report (unique constraint: watch + quarter + financial_year)
    const existing = await db.queryRow<{ id: number }>`
      SELECT id FROM quarterly_reports
      WHERE watch = ${req.watch}
        AND quarter = ${req.quarter}
        AND financial_year = ${req.financial_year}
    `;
    if (existing) {
      throw APIError.alreadyExists(
        `A report for ${req.watch} Watch Q${req.quarter} ${req.financial_year}/${req.financial_year + 1} already exists`
      );
    }

    // Create the report
    const report = await db.queryRow<DBReport>`
      INSERT INTO quarterly_reports
        (station_name, watch, watch_commander_name, quarter, financial_year, status, created_by)
      VALUES
        (${stationName}, ${req.watch}, ${req.watch_commander_name},
         ${req.quarter}, ${req.financial_year}, 'draft', ${auth.userID})
      RETURNING *
    `;
    if (!report) throw APIError.internal("failed to create quarterly report");

    // Seed the 14 standard KPI rows
    const items: QuarterlyReportItem[] = [];
    for (const kpi of KPI_TEMPLATE) {
      const item = await db.queryRow<DBItem>`
        INSERT INTO quarterly_report_items
          (report_id, kpi_code, description, target_text, row_color, category, sort_order)
        VALUES
          (${report.id}, ${kpi.kpi_code}, ${kpi.description}, ${kpi.target_text},
           ${kpi.row_color}, ${kpi.category}, ${kpi.sort_order})
        RETURNING *
      `;
      if (item) {
        items.push({
          id: item.id,
          report_id: item.report_id,
          kpi_code: item.kpi_code,
          description: item.description,
          target_text: item.target_text,
          row_color: item.row_color,
          category: item.category,
          sort_order: item.sort_order,
          met: item.met,
          actual_value: item.actual_value ?? undefined,
          rationale: item.rationale ?? undefined,
          created_at: toISO(item.created_at),
          updated_at: toISO(item.updated_at),
        });
      }
    }

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
      custom_items: [],
    };

    return { report: result };
  }
);
