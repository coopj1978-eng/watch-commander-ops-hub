import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateAbsenceRequest, Absence } from "./types";
import { assertNoOpenSickness, recalcTriggersSafely } from "../lib/sickness";
import { absenceViewer, assertCanManageAbsencesOf, notifyLineManagers } from "../lib/absenceAccess";

export const create = api<CreateAbsenceRequest, Absence>(
  { auth: true, expose: true, method: "POST", path: "/absences" },
  async (req) => {
    const auth = getAuthData()!;
    // Anyone can record their own. Any WC/CC can book anyone off sick — the
    // call may come to whoever is on duty, e.g. a Head for Head from
    // another watch. Other absence types for someone else are their own
    // watch's WC/CC.
    if (req.user_id !== auth.userID) {
      if (req.type === "sickness") {
        if (auth.role !== "WC" && auth.role !== "CC") {
          throw APIError.permissionDenied("Only a Watch Commander or Crew Commander can book someone off sick.");
        }
      } else {
        await assertCanManageAbsencesOf(await absenceViewer(), req.user_id);
      }
    }
    if (req.type === "sickness") {
      await assertNoOpenSickness(req.user_id);
    }

    // WC and CC logging a sick booking confirms it immediately — no separate approval needed
    const autoApprove = req.type === "sickness" && (auth.role === "WC" || auth.role === "CC");
    const status = autoApprove ? "approved" : "pending";

    const absence = await db.queryRow<Absence>`
      INSERT INTO absences (firefighter_id, type, start_date, end_date, reason, docs, status, approved_by, approved_at)
      VALUES (
        ${req.user_id},
        ${req.type},
        ${req.start_date},
        ${req.end_date},
        ${req.reason},
        ${req.evidence_urls ?? null},
        ${status},
        ${autoApprove ? auth.userID : null},
        ${autoApprove ? new Date() : null}
      )
      RETURNING *
    `;

    if (!absence) {
      throw new Error("Failed to create absence");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_absence",
      entity_type: "absence",
      entity_id: absence.id.toString(),
      details: { start_date: req.start_date, end_date: req.end_date, type: req.type, auto_approved: autoApprove },
    });

    // Booked off by whoever took the call — the person's own watch WC/CC
    // are always told (minus the logger).
    if (req.type === "sickness") {
      const names = await db.queryRow<{ person: string; logger: string }>`
        SELECT (SELECT name FROM users WHERE id = ${req.user_id}) AS person,
               (SELECT name FROM users WHERE id = ${auth.userID}) AS logger
      `;
      const from = new Date(req.start_date).toLocaleDateString("en-GB");
      await notifyLineManagers(req.user_id, auth.userID, {
        title: "Booked off sick",
        message: `${names?.person ?? "A member of your watch"} has been booked off sick from ${from}. Booked by ${names?.logger ?? "a WC/CC"}.`,
        absenceId: absence.id,
      });
    }

    await recalcTriggersSafely(absence.firefighter_id);
    return absence;
  }
);
