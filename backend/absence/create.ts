import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { createNotification } from "../notification/helpers";
import type { CreateAbsenceRequest, Absence } from "./types";

export const create = api<CreateAbsenceRequest, Absence>(
  { auth: true, expose: true, method: "POST", path: "/absences" },
  async (req) => {
    const auth = getAuthData()!;

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

    // When a sick booking is logged, notify WC users on the same watch (except the logger)
    if (req.type === "sickness") {
      try {
        const sickPerson = await db.queryRow<{ name: string; watch_unit: string | null }>`
          SELECT name, watch_unit FROM users WHERE id = ${req.user_id}
        `;
        const logger = await db.queryRow<{ name: string }>`
          SELECT name FROM users WHERE id = ${auth.userID}
        `;

        if (sickPerson && sickPerson.watch_unit) {
          const watchUnit = sickPerson.watch_unit;
          const loggerName = logger?.name ?? "Unknown";
          const personName = sickPerson.name;

          // Notify all WC users on the same watch, except whoever just logged it
          const wcUsers = db.query<{ id: string }>`
            SELECT id FROM users
            WHERE role = 'WC'
              AND is_active = TRUE
              AND watch_unit = ${watchUnit}
              AND id != ${auth.userID}
          `;

          for await (const wc of wcUsers) {
            await createNotification({
              user_id: wc.id,
              type: "sick_booking",
              title: "Sick Booking Logged",
              message: `${personName} has been booked off sick (${watchUnit} Watch). eForm submitted. Logged by ${loggerName}.`,
              entity_type: "absence",
              entity_id: absence.id.toString(),
              link: "/people",
            });
          }
        }
      } catch (err) {
        // Non-fatal — don't fail the absence creation if notifications error
        console.error("Failed to send sick booking notifications:", err);
      }
    }

    return absence;
  }
);
