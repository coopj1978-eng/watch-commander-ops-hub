import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { UpdateItemRequest, UpdateItemResponse, QuarterlyReportItem } from "./types";

interface PathParams {
  id: number;
  itemId: number;
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

export const updateItem = api<PathParams & UpdateItemRequest, UpdateItemResponse>(
  { auth: true, expose: true, method: "PUT", path: "/quarterly-reports/:id/items/:itemId" },
  async (req) => {
    const existing = await db.queryRow<DBItem>`
      SELECT * FROM quarterly_report_items
      WHERE id = ${req.itemId} AND report_id = ${req.id}
    `;
    if (!existing) throw APIError.notFound("report item not found");

    const newMet = req.met !== undefined ? req.met : existing.met;
    const newActual = req.actual_value !== undefined ? req.actual_value : existing.actual_value;
    const newRationale = req.rationale !== undefined ? req.rationale : existing.rationale;
    const newTarget = req.target_text !== undefined ? req.target_text : existing.target_text;

    const updated = await db.queryRow<DBItem>`
      UPDATE quarterly_report_items
      SET
        met = ${newMet},
        actual_value = ${newActual ?? null},
        rationale = ${newRationale ?? null},
        target_text = ${newTarget},
        updated_at = NOW()
      WHERE id = ${req.itemId}
      RETURNING *
    `;
    if (!updated) throw APIError.internal("failed to update item");

    const item: QuarterlyReportItem = {
      id: updated.id,
      report_id: updated.report_id,
      kpi_code: updated.kpi_code,
      description: updated.description,
      target_text: updated.target_text,
      row_color: updated.row_color,
      category: updated.category,
      sort_order: updated.sort_order,
      met: updated.met,
      actual_value: updated.actual_value ?? undefined,
      rationale: updated.rationale ?? undefined,
      created_at: toISO(updated.created_at),
      updated_at: toISO(updated.updated_at),
    };

    return { item };
  }
);
