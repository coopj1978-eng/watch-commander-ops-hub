import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { CreateApplianceRequest, Appliance } from "./types";

export const createAppliance = api<CreateApplianceRequest, Appliance>(
  { auth: true, expose: true, method: "POST", path: "/appliances" },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC") {
      throw APIError.permissionDenied("Only Watch Commanders can create appliances");
    }

    const appliance = await db.queryRow<Appliance>`
      INSERT INTO appliances (call_sign, name, type, station_call_sign, station_name)
      VALUES (${req.call_sign}, ${req.name}, ${req.type}, ${req.station_call_sign}, ${req.station_name})
      RETURNING *
    `;

    if (!appliance) {
      throw APIError.internal("Failed to create appliance");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_appliance",
      entity_type: "appliance",
      entity_id: appliance.id.toString(),
      details: { call_sign: appliance.call_sign, name: appliance.name },
    });

    return appliance;
  }
);
