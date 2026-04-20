import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { EquipmentDefect, ReportDefectRequest } from "./types";

// ──────────────────────────────────────────────────────────────────────────────
// Report a defect outside of the J4 check flow.
//
// Supports three defect types:
//   - 'equipment' : ties to a specific equipment_item on an appliance. Behaves
//                   like a J4-derived defect except check_item_id is NULL.
//   - 'appliance' : vehicle-level issue (engine warning, hydraulic leak, etc.).
//                   appliance_id is required, equipment_item_id is not.
//   - 'station'   : station / infrastructure issue. No FK refs — uses the free-
//                   text 'location' field instead (e.g. "Appliance Bay 2").
//
// The DB check constraint (migration 059) enforces the required-field matrix;
// this endpoint validates up front so users get a clear error instead of a
// constraint violation.
// ──────────────────────────────────────────────────────────────────────────────

export const reportDefect = api<ReportDefectRequest, EquipmentDefect>(
  { auth: true, expose: true, method: "POST", path: "/appliances/defects" },
  async (req) => {
    const auth = getAuthData()!;

    if (!req.title?.trim()) {
      throw APIError.invalidArgument("title is required");
    }
    if (!req.description?.trim()) {
      throw APIError.invalidArgument("description is required");
    }

    // Per-type validation
    if (req.defect_type === "equipment") {
      if (!req.appliance_id || !req.equipment_item_id) {
        throw APIError.invalidArgument("equipment defects need both appliance_id and equipment_item_id");
      }
    } else if (req.defect_type === "appliance") {
      if (!req.appliance_id) {
        throw APIError.invalidArgument("appliance defects need an appliance_id");
      }
    } else if (req.defect_type === "station") {
      // No FK refs required. appliance_id / equipment_item_id are ignored.
    } else {
      throw APIError.invalidArgument("defect_type must be equipment, appliance, or station");
    }

    const applianceId = req.defect_type === "station" ? null : (req.appliance_id ?? null);
    const equipmentItemId = req.defect_type === "equipment" ? (req.equipment_item_id ?? null) : null;
    const location = req.defect_type === "station" ? (req.location?.trim() || null) : null;

    const row = await db.rawQueryRow<EquipmentDefect>(
      `INSERT INTO equipment_defects (
         defect_type, appliance_id, equipment_item_id,
         reported_by, title, description, location, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Open')
       RETURNING *`,
      req.defect_type,
      applianceId,
      equipmentItemId,
      auth.userID,
      req.title.trim(),
      req.description.trim(),
      location,
    );

    if (!row) {
      throw APIError.internal("failed to create defect");
    }

    return row;
  }
);
