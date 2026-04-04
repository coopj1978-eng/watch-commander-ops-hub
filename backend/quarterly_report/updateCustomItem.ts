import { api, APIError } from "encore.dev/api";
import db from "../db";
import type { UpdateCustomItemRequest, UpdateCustomItemResponse, QuarterlyReportCustomItem } from "./types";

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

export const updateCustomItem = api<
  { id: number; itemId: number } & UpdateCustomItemRequest,
  UpdateCustomItemResponse
>(
  { auth: true, expose: true, method: "PUT", path: "/quarterly-reports/:id/custom-items/:itemId" },
  async (req) => {
    const existing = await db.queryRow<DBCustomItem>`
      SELECT * FROM quarterly_report_custom_items
      WHERE id = ${req.itemId} AND report_id = ${req.id}
    `;
    if (!existing) throw APIError.notFound("custom item not found");

    const newDesc = req.description !== undefined ? req.description : existing.description;
    const newTarget = req.target_text !== undefined ? req.target_text : existing.target_text;
    const newMet = req.met !== undefined ? req.met : existing.met;
    const newRationale = req.rationale !== undefined ? req.rationale : existing.rationale;

    const updated = await db.queryRow<DBCustomItem>`
      UPDATE quarterly_report_custom_items
      SET
        description = ${newDesc},
        target_text = ${newTarget ?? null},
        met = ${newMet},
        rationale = ${newRationale ?? null},
        updated_at = NOW()
      WHERE id = ${req.itemId}
      RETURNING *
    `;
    if (!updated) throw APIError.internal("failed to update custom item");

    const item: QuarterlyReportCustomItem = {
      id: updated.id,
      report_id: updated.report_id,
      description: updated.description,
      target_text: updated.target_text ?? undefined,
      met: updated.met,
      rationale: updated.rationale ?? undefined,
      sort_order: updated.sort_order,
      created_at: toISO(updated.created_at),
      updated_at: toISO(updated.updated_at),
    };

    return { item };
  }
);
