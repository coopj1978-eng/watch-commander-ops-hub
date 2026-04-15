import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";

// DELETE /crewing/:id — remove a crew member from a shift
export const remove = api<{ id: number }, { ok: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/crewing/:id" },
  async (req) => {
    const auth = getAuthData()!;

    // Capture identifying fields before the delete so the audit log is meaningful
    const existing = await db.rawQueryRow<{
      watch: string;
      shift_date: string;
      shift_type: string;
      appliance: string;
      crew_role: string;
      user_id: string | null;
      external_name: string | null;
    }>(
      `SELECT watch, shift_date::text, shift_type, appliance, crew_role,
              user_id, external_name
       FROM shift_crewing WHERE id = $1`,
      req.id
    );

    await db.exec`DELETE FROM shift_crewing WHERE id = ${req.id}`;

    await logActivity({
      user_id: auth.userID,
      action: "remove_crewing",
      entity_type: "shift_crewing",
      entity_id: req.id.toString(),
      details: existing ?? { note: "row not found at delete time" },
    });

    return { ok: true };
  }
);
