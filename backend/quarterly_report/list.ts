import { api } from "encore.dev/api";
import db from "../db";
import type { ListReportsRequest, ListReportsResponse, QuarterlyReportSummary } from "./types";

interface DBSummary {
  id: number;
  station_name: string;
  watch: string;
  watch_commander_name: string;
  quarter: number;
  financial_year: number;
  status: string;
  items_total: number;
  items_met: number;
  created_at: Date;
  updated_at: Date;
}

function toISO(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

export const list = api<ListReportsRequest, ListReportsResponse>(
  { auth: true, expose: true, method: "GET", path: "/quarterly-reports" },
  async (req) => {
    // Build filters dynamically
    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (req.watch) {
      conditions.push(`qr.watch = $${pIdx++}`);
      params.push(req.watch);
    }
    if (req.financial_year) {
      conditions.push(`qr.financial_year = $${pIdx++}`);
      params.push(req.financial_year);
    }
    if (req.quarter) {
      conditions.push(`qr.quarter = $${pIdx++}`);
      params.push(req.quarter);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await db.rawQueryAll<DBSummary>(
      `SELECT
         qr.id, qr.station_name, qr.watch, qr.watch_commander_name,
         qr.quarter, qr.financial_year, qr.status,
         COUNT(qi.id)::int AS items_total,
         COUNT(qi.id) FILTER (WHERE qi.met = true)::int AS items_met,
         qr.created_at, qr.updated_at
       FROM quarterly_reports qr
       LEFT JOIN quarterly_report_items qi ON qi.report_id = qr.id
       ${where}
       GROUP BY qr.id
       ORDER BY qr.financial_year DESC, qr.quarter DESC, qr.watch ASC`,
      ...params
    );

    const reports: QuarterlyReportSummary[] = rows.map((r) => ({
      id: r.id,
      station_name: r.station_name,
      watch: r.watch,
      watch_commander_name: r.watch_commander_name,
      quarter: r.quarter,
      financial_year: r.financial_year,
      status: r.status as "draft" | "submitted",
      items_total: r.items_total,
      items_met: r.items_met,
      created_at: toISO(r.created_at),
      updated_at: toISO(r.updated_at),
    }));

    return { reports };
  }
);
