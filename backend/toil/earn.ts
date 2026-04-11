import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { createNotification } from "../notification/helpers";
import type { EarnToilRequest, ToilEntry } from "./types";

/** Financial year (April-start). */
function financialYear(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

// POST /toil/earn — Log TOIL hours earned (pending WC/CC approval)
export const earn = api<EarnToilRequest, ToilEntry>(
  { auth: true, expose: true, method: "POST", path: "/toil/earn" },
  async (req) => {
    const auth = getAuthData()!;

    if (req.hours <= 0) throw APIError.invalidArgument("Hours must be greater than 0.");
    if (!req.reason?.trim()) throw APIError.invalidArgument("A reason is required.");

    // Determine target user
    let targetUserId = auth.userID;
    if (req.for_user_id) {
      const callerRole = await db.queryRow<{ role: string }>`
        SELECT role FROM users WHERE id = ${auth.userID}
      `;
      if (!callerRole || !["WC", "CC"].includes(callerRole.role)) {
        throw APIError.permissionDenied("Only WC/CC can log TOIL for other users.");
      }
      targetUserId = req.for_user_id;
    }

    const userInfo = await db.queryRow<{ name: string; watch_unit: string | null }>`
      SELECT name, watch_unit FROM users WHERE id = ${targetUserId}
    `;
    if (!userInfo?.watch_unit) {
      throw APIError.failedPrecondition("User must have a watch unit assigned.");
    }

    const incidentDate = new Date(req.incident_date);
    const fy = financialYear(incidentDate);

    // If WC/CC is logging it, auto-approve
    const callerRole = await db.queryRow<{ role: string }>`
      SELECT role FROM users WHERE id = ${auth.userID}
    `;
    const isManager = callerRole && ["WC", "CC"].includes(callerRole.role);
    const autoApprove = isManager;

    const entry = await db.rawQueryRow<ToilEntry>(
      `INSERT INTO toil_ledger (user_id, type, hours, status, approved_by_user_id, approved_at, reason, job_number, incident_date, financial_year, watch_unit, created_by)
       VALUES ($1, 'earned', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      targetUserId,
      req.hours,
      autoApprove ? "approved" : "pending",
      autoApprove ? auth.userID : null,
      autoApprove ? new Date() : null,
      req.reason.trim(),
      req.job_number?.trim() || null,
      req.incident_date,
      fy,
      userInfo.watch_unit,
      auth.userID
    );

    if (!entry) throw APIError.internal("Failed to create TOIL entry.");

    // Notify WC/CC if pending approval (FF logged it themselves)
    if (!autoApprove) {
      try {
        const wcUsers = db.query<{ id: string }>`
          SELECT id FROM users
          WHERE role IN ('WC', 'CC') AND left_at IS NULL AND watch_unit = ${userInfo.watch_unit}
            AND id != ${auth.userID}
        `;
        const dateStr = incidentDate.toLocaleDateString("en-GB");
        for await (const wc of wcUsers) {
          await createNotification({
            user_id: wc.id,
            type: "general",
            title: "TOIL Approval Required",
            message: `${userInfo.name} has logged ${req.hours}hr TOIL for ${dateStr}. Reason: ${req.reason.trim()}`,
            entity_type: "toil",
            entity_id: entry.id.toString(),
            link: "/admin",
          });
        }
      } catch (err) {
        console.error("Failed to send TOIL notification:", err);
      }
    }

    return entry;
  }
);
