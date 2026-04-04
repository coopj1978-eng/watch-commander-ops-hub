import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { H4HEntry, ListH4HRequest, ListH4HResponse } from "./types";

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

function toEntry(r: DBEntry): H4HEntry {
  return {
    id: r.id,
    creditor_user_id: r.creditor_user_id,
    creditor_name: r.creditor_name,
    debtor_user_id: r.debtor_user_id,
    debtor_name: r.debtor_name,
    shift_date: r.shift_date instanceof Date
      ? r.shift_date.toISOString().split("T")[0]
      : String(r.shift_date).split("T")[0],
    shift_adjustment_id: r.shift_adjustment_id,
    payback_shift_adjustment_id: r.payback_shift_adjustment_id,
    status: r.status as "pending" | "settled",
    settled_at: r.settled_at ? r.settled_at.toISOString() : null,
    settled_by_user_id: r.settled_by_user_id,
    settled_via: r.settled_via as "auto" | "manual" | null,
    notes: r.notes,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

export const list = api<ListH4HRequest, ListH4HResponse>(
  { auth: true, expose: true, method: "GET", path: "/h4h" },
  async (req) => {
    getAuthData()!; // ensure authenticated

    const statusFilter = req.status ?? "pending";

    const rows = await db.rawQueryAll<DBEntry>(
      `SELECT * FROM h4h_ledger
       WHERE (creditor_user_id = $1 OR debtor_user_id = $1)
         AND status = $2
       ORDER BY shift_date DESC, created_at DESC`,
      req.user_id,
      statusFilter
    );

    const owed_to_me = rows.filter((r) => r.creditor_user_id === req.user_id).map(toEntry);
    const i_owe      = rows.filter((r) => r.debtor_user_id   === req.user_id).map(toEntry);

    return { owed_to_me, i_owe };
  }
);
