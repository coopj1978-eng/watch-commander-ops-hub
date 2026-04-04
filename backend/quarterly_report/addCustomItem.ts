import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { AddCustomItemRequest, AddCustomItemResponse, QuarterlyReportCustomItem } from "./types";

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

export const addCustomItem = api<{ id: number } & AddCustomItemRequest, AddCustomItemResponse>(
  { auth: true, expose: true, method: "POST", path: "/quarterly-reports/:id/custom-items" },
  async (req) => {
    const reportExists = await db.queryRow<{ id: number }>`
      SELECT id FROM quarterly_reports WHERE id = ${req.id}
    `;
    if (!reportExists) throw APIError.notFound("quarterly report not found");

    const maxSort = await db.queryRow<{ max_sort: number | null }>`
      SELECT MAX(sort_order) AS max_sort FROM quarterly_report_custom_items WHERE report_id = ${req.id}
    `;
    const nextSort = (maxSort?.max_sort ?? 0) + 1;

    const row = await db.queryRow<DBCustomItem>`
      INSERT INTO quarterly_report_custom_items
        (report_id, description, target_text, sort_order)
      VALUES
        (${req.id}, ${req.description ?? ""}, ${req.target_text ?? null}, ${nextSort})
      RETURNING *
    `;
    if (!row) throw APIError.internal("failed to add custom item");

    const item: QuarterlyReportCustomItem = {
      id: row.id,
      report_id: row.report_id,
      description: row.description,
      target_text: row.target_text ?? undefined,
      met: row.met,
      rationale: row.rationale ?? undefined,
      sort_order: row.sort_order,
      created_at: toISO(row.created_at),
      updated_at: toISO(row.updated_at),
    };

    return { item };
  }
);
