import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateApplianceRequest, Appliance } from "./types";

export const updateAppliance = api<UpdateApplianceRequest, Appliance>(
  { auth: true, expose: true, method: "PATCH", path: "/appliances/:id" },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC") {
      throw APIError.permissionDenied("Only Watch Commanders can update appliances");
    }

    const { id, ...updates } = req;
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.call_sign !== undefined) {
      setClauses.push(`call_sign = $${paramIndex++}`);
      params.push(updates.call_sign);
    }
    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.type !== undefined) {
      setClauses.push(`type = $${paramIndex++}`);
      params.push(updates.type);
    }
    if (updates.active !== undefined) {
      setClauses.push(`active = $${paramIndex++}`);
      params.push(updates.active);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("No updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE appliances SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
    const appliance = await db.rawQueryRow<Appliance>(query, ...params);

    if (!appliance) {
      throw APIError.notFound("Appliance not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_appliance",
      entity_type: "appliance",
      entity_id: id.toString(),
      details: updates,
    });

    return appliance;
  }
);
