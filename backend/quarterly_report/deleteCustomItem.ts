import { api, APIError } from "encore.dev/api";
import db from "../db";

export const deleteCustomItem = api<{ id: number; itemId: number }, void>(
  { auth: true, expose: true, method: "DELETE", path: "/quarterly-reports/:id/custom-items/:itemId" },
  async (req) => {
    const existing = await db.queryRow<{ id: number }>`
      SELECT id FROM quarterly_report_custom_items
      WHERE id = ${req.itemId} AND report_id = ${req.id}
    `;
    if (!existing) throw APIError.notFound("custom item not found");

    await db.exec`
      DELETE FROM quarterly_report_custom_items WHERE id = ${req.itemId}
    `;
  }
);
