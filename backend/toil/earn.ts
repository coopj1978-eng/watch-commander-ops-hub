import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { createNotification } from "../notification/helpers";
import type { EarnToilRequest, ToilEntry } from "./types";

/** Financial year (April-start). */
function financialYear(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /toil/earn — Log TOIL hours for the caller (or, if WC/CC, for someone
// else on their watch).
//
// Authorisation policy (changed 2026-04-25):
//   • All TOIL entries are created with status='pending'. Even a WC/CC
//     adding hours for themselves or another crew member needs another
//     WC/CC to approve. This prevents self-dealing — no one approves their
//     own log entry.
//   • Pending entries fire a `general` notification to every active WC/CC
//     on the recipient's watch (minus the creator), so an authorisation
//     prompt always lands in someone's bell.
//
// Watch lookup uses the COALESCE(users.watch_unit, firefighter_profiles.watch)
// pattern that the rest of the app uses — older accounts where one column
// drifted from the other still resolve correctly.
// ─────────────────────────────────────────────────────────────────────────────
export const earn = api<EarnToilRequest, ToilEntry>(
  { auth: true, expose: true, method: "POST", path: "/toil/earn" },
  async (req) => {
    const auth = getAuthData()!;

    if (req.hours <= 0) {
      throw APIError.invalidArgument("Hours must be greater than 0.");
    }
    if (!req.reason?.trim()) {
      throw APIError.invalidArgument("A reason is required.");
    }

    // Resolve target user. Only WC/CC may log on someone else's behalf.
    let targetUserId = auth.userID;
    if (req.for_user_id && req.for_user_id !== auth.userID) {
      const callerRole = await db.queryRow<{ role: string }>`
        SELECT role FROM users WHERE id = ${auth.userID}
      `;
      if (!callerRole || !["WC", "CC"].includes(callerRole.role)) {
        throw APIError.permissionDenied("Only WC/CC can log TOIL for other users.");
      }
      targetUserId = req.for_user_id;
    }

    // Watch lookup with COALESCE so users without users.watch_unit but with
    // a valid firefighter_profiles.watch still resolve. Matches the pattern
    // in crew/get_stats.ts and crewing/roster.ts.
    const userInfo = await db.queryRow<{ name: string; watch_unit: string | null }>`
      SELECT u.name, COALESCE(u.watch_unit, fp.watch) AS watch_unit
      FROM users u
      LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
      WHERE u.id = ${targetUserId}
    `;
    if (!userInfo) {
      throw APIError.notFound("Target user not found.");
    }
    if (!userInfo.watch_unit) {
      throw APIError.failedPrecondition(
        "Target user has no watch unit on either their account or their firefighter profile — assign one first."
      );
    }

    const incidentDate = new Date(req.incident_date);
    if (Number.isNaN(incidentDate.getTime())) {
      throw APIError.invalidArgument("Invalid incident_date.");
    }
    const fy = financialYear(incidentDate);

    // ── Insert as pending — every TOIL entry is now subject to review by
    //    a different WC/CC. The earn endpoint never auto-approves. ─────────
    let entry: ToilEntry | null = null;
    try {
      entry = await db.rawQueryRow<ToilEntry>(
        `INSERT INTO toil_ledger (
           user_id, type, hours, status,
           reason, job_number, incident_date,
           financial_year, watch_unit, created_by
         )
         VALUES ($1, 'earned', $2, 'pending', $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        targetUserId,
        req.hours,
        req.reason.trim(),
        req.job_number?.trim() || null,
        // Encore pg driver accepts the ISO datetime string and Postgres
        // truncates it for the DATE column.
        req.incident_date,
        fy,
        userInfo.watch_unit,
        auth.userID
      );
    } catch (err) {
      // Surface the underlying DB error in the server log so an "internal
      // error" toast on the client is debuggable from the deploy logs.
      console.error("toil/earn: INSERT into toil_ledger failed", {
        targetUserId,
        callerId: auth.userID,
        watchUnit: userInfo.watch_unit,
        hours: req.hours,
        err,
      });
      throw APIError.internal(
        `Failed to record TOIL: ${err instanceof Error ? err.message : "DB error"}`
      );
    }

    if (!entry) {
      throw APIError.internal("Failed to create TOIL entry.");
    }

    // ── Notify every active WC/CC on the recipient's watch (except the
    //    creator) so an authorisation prompt always lands in a bell.
    try {
      const dateStr = incidentDate.toLocaleDateString("en-GB");
      const recipients = db.query<{ id: string }>`
        SELECT id FROM users
        WHERE role IN ('WC', 'CC')
          AND left_at IS NULL
          AND watch_unit = ${userInfo.watch_unit}
          AND id != ${auth.userID}
      `;
      const isSelfLog = targetUserId === auth.userID;
      const subject = isSelfLog
        ? `${userInfo.name} logged ${req.hours}hr TOIL for themselves`
        : `${req.hours}hr TOIL logged for ${userInfo.name}`;
      for await (const r of recipients) {
        await createNotification({
          user_id: r.id,
          type: "general",
          title: "TOIL Approval Required",
          message: `${subject} (${dateStr}). Reason: ${req.reason.trim()}`,
          entity_type: "toil",
          entity_id: entry.id.toString(),
          // Link to the recipient's profile TOIL tab so the approver can
          // review the full ledger context, not just the single entry.
          link: `/people/${encodeURIComponent(targetUserId)}`,
        });
      }
    } catch (err) {
      // Notifications must never block the create.
      console.error("Failed to send TOIL approval notifications:", err);
    }

    return entry;
  }
);
