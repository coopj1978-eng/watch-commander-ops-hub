import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { EquipmentDefect, ReportDefectRequest } from "./types";

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"];

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
    // Kit from the list: "Missing" is the whole story. A typed-in item needs remarks.
    if (req.defect_type !== "equipment" && !req.description?.trim()) {
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

    // The board's extra columns. Anyone can say a J7 has gone in. Only a
    // WC/CC can put a line up for another watch, back-date it, or mark it as
    // already ordered — that's for copying up what's on the office board.
    const isManager = auth.role === "WC" || auth.role === "CC";
    const askedWatch = WATCHES.find((w) => w.toLowerCase() === (req.watch ?? "").trim().toLowerCase());
    const ownWatch = WATCHES.find((w) => w.toLowerCase() === (auth.watchUnit ?? "").toLowerCase());
    const watch = (isManager && askedWatch) || ownWatch || null;

    let reportedAt: string | null = null;
    if (isManager && req.reported_on) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.reported_on) || Number.isNaN(Date.parse(req.reported_on))) {
        throw APIError.invalidArgument("reported_on must be a date (YYYY-MM-DD)");
      }
      if (req.reported_on > new Date().toISOString().slice(0, 10)) {
        throw APIError.invalidArgument("reported_on can't be in the future");
      }
      reportedAt = `${req.reported_on}T12:00:00Z`;
    }
    const status = isManager && req.status === "Ordered" ? "Ordered" : "Open";

    const applianceId = req.defect_type === "station" ? null : (req.appliance_id ?? null);
    const equipmentItemId = req.defect_type === "equipment" ? (req.equipment_item_id ?? null) : null;
    const location = req.defect_type === "station" ? (req.location?.trim() || null) : null;

    const row = await db.rawQueryRow<EquipmentDefect>(
      `INSERT INTO equipment_defects (
         defect_type, appliance_id, equipment_item_id,
         reported_by, title, description, location, status,
         j7_raised, watch, reported_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, NOW()))
       RETURNING *`,
      req.defect_type,
      applianceId,
      equipmentItemId,
      auth.userID,
      req.title.trim(),
      (req.description ?? "").trim(),
      location,
      status,
      !!req.j7_raised,
      watch,
      reportedAt,
    );

    if (!row) {
      throw APIError.internal("failed to create defect");
    }

    return row;
  }
);
