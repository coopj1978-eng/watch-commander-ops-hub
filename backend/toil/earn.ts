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
//
// Every DB call is individually try/caught — Encore's default error-shape
// for an unhandled exception is just "an internal error occurred" with no
// detail, which is useless for debugging. Each call wraps its own error so
// the message returned to the client identifies exactly which step failed.
// ─────────────────────────────────────────────────────────────────────────────
export const earn = api<EarnToilRequest, ToilEntry>(
  { auth: true, expose: true, method: "POST", path: "/toil/earn" },
  async (req) => {
    try {
      return await earnImpl(req);
    } catch (err) {
      // Re-throw existing APIErrors unchanged so client sees the original
      // code (permissionDenied, notFound, failedPrecondition, etc.).
      // For anything else — uncaught, unexpected — re-wrap as `unavailable`
      // with the underlying message so the client gets something
      // diagnosable instead of Encore's masked "an internal error occurred."
      if (err instanceof APIError) throw err;
      console.error("toil/earn: top-level catch caught unexpected error", err);
      throw APIError.unavailable(
        `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
);

async function earnImpl(req: EarnToilRequest): Promise<ToilEntry> {
    const auth = getAuthData()!;

    // ── Input validation ────────────────────────────────────────────────────
    if (req.hours <= 0) {
      throw APIError.invalidArgument("Hours must be greater than 0.");
    }
    if (!req.reason?.trim()) {
      throw APIError.invalidArgument("A reason is required.");
    }
    if (!req.incident_date) {
      throw APIError.invalidArgument("Incident date is required.");
    }
    const incidentDate = new Date(req.incident_date);
    if (Number.isNaN(incidentDate.getTime())) {
      throw APIError.invalidArgument(
        `Invalid incident_date format: ${req.incident_date}`
      );
    }
    const fy = financialYear(incidentDate);

    // ── Caller role lookup (only needed if logging for someone else) ────────
    let targetUserId = auth.userID;
    if (req.for_user_id && req.for_user_id !== auth.userID) {
      let callerRole: { role: string } | null = null;
      try {
        callerRole = await db.rawQueryRow<{ role: string }>(
          `SELECT role FROM users WHERE id = $1`,
          auth.userID
        );
      } catch (err) {
        console.error("toil/earn: caller role lookup failed", { auth, err });
        throw APIError.unavailable(
          `Caller role lookup failed: ${err instanceof Error ? err.message : "DB error"}`
        );
      }
      if (!callerRole || !["WC", "CC"].includes(callerRole.role)) {
        throw APIError.permissionDenied(
          "Only WC/CC can log TOIL for other users."
        );
      }
      targetUserId = req.for_user_id;
    }

    // ── Target user + watch lookup ─────────────────────────────────────────
    // COALESCE(users.watch_unit, firefighter_profiles.watch) so accounts
    // where one column has drifted from the other still resolve. Same
    // pattern as crew/get_stats.ts and crewing/roster.ts.
    let userInfo: { name: string; watch_unit: string | null } | null = null;
    try {
      userInfo = await db.rawQueryRow<{
        name: string;
        watch_unit: string | null;
      }>(
        `SELECT u.name,
                COALESCE(u.watch_unit, fp.watch) AS watch_unit
         FROM users u
         LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
         WHERE u.id = $1`,
        targetUserId
      );
    } catch (err) {
      console.error("toil/earn: target user lookup failed", {
        targetUserId,
        err,
      });
      throw APIError.unavailable(
        `Target user lookup failed: ${err instanceof Error ? err.message : "DB error"}`
      );
    }
    if (!userInfo) {
      throw APIError.notFound(`Target user not found (id=${targetUserId}).`);
    }
    if (!userInfo.watch_unit) {
      throw APIError.failedPrecondition(
        `${userInfo.name} has no watch unit on either their account or their firefighter profile — assign one in Settings before logging TOIL.`
      );
    }

    // ── Insert as pending ──────────────────────────────────────────────────
    // toil_ledger.incident_date is a DATE column. The pg serializer rejects
    // a full ISO datetime string ("2026-04-25T00:00:00.000Z") with
    // "error serializing parameter: trailing input" because it parses the
    // date portion successfully and then complains about the time portion
    // it doesn't expect. Strip down to YYYY-MM-DD before binding.
    const dateOnly = (req.incident_date.includes("T")
      ? req.incident_date.split("T")[0]
      : req.incident_date
    ).slice(0, 10); // safety belt — clip to 10 chars in case of stray trailing data

    let entry: ToilEntry | null = null;
    try {
      entry = await db.rawQueryRow<ToilEntry>(
        `INSERT INTO toil_ledger (
           user_id, type, hours, status,
           reason, job_number, incident_date,
           financial_year, watch_unit, created_by
         )
         VALUES ($1, 'earned', $2, 'pending', $3, $4, $5::date, $6, $7, $8)
         RETURNING *`,
        targetUserId,
        req.hours,
        req.reason.trim(),
        req.job_number?.trim() || null,
        dateOnly,
        fy,
        userInfo.watch_unit,
        auth.userID
      );
    } catch (err) {
      console.error("toil/earn: INSERT into toil_ledger failed", {
        targetUserId,
        callerId: auth.userID,
        watchUnit: userInfo.watch_unit,
        hours: req.hours,
        incidentDate: req.incident_date,
        err,
      });
      throw APIError.unavailable(
        `INSERT failed: ${err instanceof Error ? err.message : "DB error"}`
      );
    }

    if (!entry) {
      throw APIError.unavailable(
        "INSERT returned no row — check toil_ledger schema."
      );
    }

    // ── Notify every active WC/CC on the recipient's watch — INCLUDING
    //    the creator. The creator gets a self-reminder message ("you
    //    logged X hr TOIL for Y — needs authorisation") so the entry
    //    doesn't sit forgotten in pending. Other WC/CCs get an
    //    informational version. Either way the bell badge ticks up
    //    and clicking the notification deep-links to the recipient's
    //    profile TOIL tab where the ✓ / ✗ buttons live.
    //
    //    Wrapped so a notification dispatch failure never blocks the
    //    create.
    try {
      const dateStr = incidentDate.toLocaleDateString("en-GB");
      const recipients = db.rawQuery<{ id: string }>(
        `SELECT id FROM users
         WHERE role IN ('WC', 'CC')
           AND left_at IS NULL
           AND watch_unit = $1`,
        userInfo.watch_unit
      );
      const isSelfLog = targetUserId === auth.userID;
      // Two flavours of message body — one for the creator (self-
      // reminder) and one for everyone else (informational).
      const otherSubject = isSelfLog
        ? `${userInfo.name} logged ${req.hours}hr TOIL for themselves`
        : `${req.hours}hr TOIL logged for ${userInfo.name}`;
      const ownSubject = isSelfLog
        ? `You logged ${req.hours}hr TOIL for yourself — needs authorisation`
        : `You logged ${req.hours}hr TOIL for ${userInfo.name} — needs authorisation`;
      for await (const r of recipients) {
        const isCreator = r.id === auth.userID;
        await createNotification({
          user_id: r.id,
          type: "general",
          title: "TOIL Approval Required",
          message: `${isCreator ? ownSubject : otherSubject} (${dateStr}). Reason: ${req.reason.trim()}`,
          entity_type: "toil",
          entity_id: entry.id.toString(),
          link: `/people/${encodeURIComponent(targetUserId)}`,
        });
      }
    } catch (err) {
      console.error("toil/earn: notification dispatch failed", err);
    }

    return entry;
}
