import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { ToilEntry } from "./types";

interface UpdateToilRequest {
  id: number;
  /** New hours value. Must be > 0 if provided. */
  hours?: number;
  reason?: string;
  job_number?: string | null;
  /** YYYY-MM-DD or full ISO datetime — the time portion is stripped to
   *  fit the DATE column. Sending null clears the incident date. */
  incident_date?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /toil/:id
//
// Edit a TOIL ledger entry. WC/CC use case: a WC realises after the fact
// that they logged 20hrs instead of 22, or the wrong incident date, or
// the wrong reason. Rather than delete + recreate, edit in place — the
// approval status / approver / approved_at are preserved.
//
// Permission rules mirror the delete endpoint:
//   • Author can edit their own entry
//   • Any WC can edit any entry
//   • CC can edit entries on their own watch
//
// What you CAN edit: hours, reason, job_number, incident_date
// What you can't edit: user_id (would be a transfer), type (earned vs
//   spent — different concepts), status (use approve/reject), watch_unit
//   (use the user's profile)
// ─────────────────────────────────────────────────────────────────────────────
export const update = api<UpdateToilRequest, ToilEntry>(
  { auth: true, expose: true, method: "PATCH", path: "/toil/:id" },
  async (req) => {
    const auth = getAuthData()!;

    if (req.hours !== undefined && req.hours <= 0) {
      throw APIError.invalidArgument("Hours must be greater than 0.");
    }

    const caller = await db.queryRow<{ role: string; watch_unit: string | null }>`
      SELECT role, watch_unit FROM users WHERE id = ${auth.userID}
    `;
    if (!caller) {
      throw APIError.unauthenticated("Caller not found.");
    }

    const existing = await db.queryRow<{
      id: number;
      created_by: string;
      watch_unit: string;
    }>`
      SELECT id, created_by, watch_unit
      FROM toil_ledger
      WHERE id = ${req.id}
    `;
    if (!existing) {
      throw APIError.notFound("TOIL entry not found.");
    }

    const isAuthor = existing.created_by === auth.userID;
    const isWC = caller.role === "WC";
    const isCCOnSameWatch =
      caller.role === "CC" &&
      caller.watch_unit?.toLowerCase() === existing.watch_unit.toLowerCase();

    if (!isAuthor && !isWC && !isCCOnSameWatch) {
      throw APIError.permissionDenied(
        "You can only edit TOIL entries you logged, or any entry as a WC, or entries on your watch as a CC."
      );
    }

    // Strip ISO time portion if present, same fix as elsewhere.
    let dateOnly: string | null | undefined = undefined;
    if (req.incident_date === null) {
      dateOnly = null;
    } else if (req.incident_date) {
      dateOnly = (req.incident_date.includes("T")
        ? req.incident_date.split("T")[0]
        : req.incident_date
      ).slice(0, 10);
    }

    let updated: ToilEntry | null = null;
    try {
      updated = await db.rawQueryRow<ToilEntry>(
        `UPDATE toil_ledger SET
           hours         = COALESCE($1, hours),
           reason        = COALESCE($2, reason),
           job_number    = CASE WHEN $3::text = '__null__' THEN NULL
                                WHEN $3 IS NULL THEN job_number
                                ELSE $3 END,
           incident_date = CASE WHEN $4::text = '__null__' THEN NULL
                                WHEN $4 IS NULL THEN incident_date
                                ELSE $4::date END,
           updated_at    = NOW()
         WHERE id = $5
         RETURNING *`,
        req.hours ?? null,
        req.reason ?? null,
        req.job_number === null ? "__null__" : req.job_number ?? null,
        dateOnly === null ? "__null__" : dateOnly ?? null,
        req.id
      );
    } catch (err) {
      console.error("toil/update: UPDATE failed", { req, err });
      throw APIError.unavailable(
        `UPDATE failed: ${err instanceof Error ? err.message : "DB error"}`
      );
    }

    if (!updated) {
      throw APIError.unavailable("UPDATE returned no row.");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_toil_entry",
      entity_type: "toil",
      entity_id: req.id.toString(),
      details: {
        hours: req.hours,
        reason: req.reason,
        job_number: req.job_number,
        incident_date: dateOnly,
      },
    });

    return updated;
  }
);
