import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { H4HEntry, SettleH4HRequest } from "./types";

interface DBEntry {
  id: number;
  creditor_user_id: string;
  creditor_name: string;
  debtor_user_id: string;
  debtor_name: string;
  shift_date: Date;
  shift_adjustment_id: number | null;
  payback_shift_adjustment_id: number | null;
  status: string;
  settled_at: Date | null;
  settled_by_user_id: string | null;
  settled_via: string | null;
  notes: string | null;
  created_at: Date;
}

export const settle = api<SettleH4HRequest, H4HEntry>(
  { auth: true, expose: true, method: "POST", path: "/h4h/:id/settle" },
  async (req) => {
    const auth = getAuthData()!;

    const entry = await db.queryRow<DBEntry>`
      SELECT * FROM h4h_ledger WHERE id = ${req.id}
    `;

    if (!entry) throw APIError.notFound("H4H ledger entry not found.");
    if (entry.status === "settled") throw APIError.failedPrecondition("This entry is already settled.");

    // Only the creditor or debtor can settle
    if (entry.creditor_user_id !== auth.userID && entry.debtor_user_id !== auth.userID) {
      throw APIError.permissionDenied("You can only settle your own H4H entries.");
    }

    const updated = await db.queryRow<DBEntry>`
      UPDATE h4h_ledger SET
        status             = 'settled',
        settled_at         = NOW(),
        settled_by_user_id = ${auth.userID},
        settled_via        = 'manual',
        updated_at         = NOW()
      WHERE id = ${req.id}
      RETURNING *
    `;

    if (!updated) throw APIError.internal("Failed to settle H4H entry.");

    return {
      id: updated.id,
      creditor_user_id: updated.creditor_user_id,
      creditor_name: updated.creditor_name,
      debtor_user_id: updated.debtor_user_id,
      debtor_name: updated.debtor_name,
      shift_date: updated.shift_date instanceof Date
        ? updated.shift_date.toISOString().split("T")[0]
        : String(updated.shift_date).split("T")[0],
      shift_adjustment_id: updated.shift_adjustment_id,
      payback_shift_adjustment_id: updated.payback_shift_adjustment_id,
      status: "settled",
      settled_at: updated.settled_at ? updated.settled_at.toISOString() : new Date().toISOString(),
      settled_by_user_id: updated.settled_by_user_id,
      settled_via: "manual",
      notes: updated.notes,
      created_at: updated.created_at instanceof Date ? updated.created_at.toISOString() : String(updated.created_at),
    };
  }
);
