import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { createNotification } from "../notification/helpers";
import type { ApproveToilRequest, ToilEntry } from "./types";

// PATCH /toil/:id/approve — WC/CC approves or rejects a pending TOIL entry
export const approve = api<ApproveToilRequest, ToilEntry>(
  { auth: true, expose: true, method: "PATCH", path: "/toil/:id/approve" },
  async (req) => {
    const auth = getAuthData()!;

    // Only WC/CC can approve
    if (auth.role !== "WC" && auth.role !== "CC") {
      throw APIError.permissionDenied("Only WC/CC can approve TOIL entries.");
    }

    if (req.action !== "approved" && req.action !== "rejected") {
      throw APIError.invalidArgument("Action must be 'approved' or 'rejected'.");
    }

    const existing = await db.rawQueryRow<ToilEntry>(
      `SELECT * FROM toil_ledger WHERE id = $1`, req.id
    );

    if (!existing) throw APIError.notFound("TOIL entry not found.");
    if (existing.status !== "pending") {
      throw APIError.failedPrecondition(`This TOIL entry is already ${existing.status}.`);
    }

    const updated = await db.rawQueryRow<ToilEntry>(
      `UPDATE toil_ledger SET
        status = $1,
        approved_by_user_id = $2,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *`,
      req.action,
      auth.userID,
      req.id
    );

    if (!updated) throw APIError.internal("Failed to update TOIL entry.");

    // Notify the user
    try {
      const approverName = (await db.queryRow<{ name: string }>`
        SELECT name FROM users WHERE id = ${auth.userID}
      `)?.name ?? "Your manager";

      const verb = req.action === "approved" ? "approved" : "rejected";
      await createNotification({
        user_id: existing.user_id,
        type: "general",
        title: `TOIL ${req.action === "approved" ? "Approved" : "Rejected"}`,
        message: `${approverName} has ${verb} your ${existing.hours}hr TOIL request.`,
        entity_type: "toil",
        entity_id: req.id.toString(),
      });
    } catch (err) {
      console.error("Failed to send TOIL approval notification:", err);
    }

    return updated;
  }
);
