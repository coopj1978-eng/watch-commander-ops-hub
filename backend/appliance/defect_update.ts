import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { UpdateDefectRequest, EquipmentDefect } from "./types";

export const updateDefect = api<UpdateDefectRequest, EquipmentDefect>(
  { auth: true, expose: true, method: "PATCH", path: "/appliances/defects/:id" },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC" && auth.role !== "CC") {
      throw APIError.permissionDenied("Only Watch/Crew Commanders can update defect status");
    }

    const { id, ...updates } = req;
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);

      if (updates.status === "Resolved") {
        setClauses.push(`resolved_at = NOW()`);
        setClauses.push(`resolved_by = $${paramIndex++}`);
        params.push(auth.userID);
      }
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }

    if (setClauses.length === 0) {
      throw APIError.invalidArgument("No updates provided");
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE equipment_defects SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
    const defect = await db.rawQueryRow<EquipmentDefect>(query, ...params);

    if (!defect) {
      throw APIError.notFound("Defect not found");
    }

    await logActivity({
      user_id: auth.userID,
      action: "update_defect",
      entity_type: "equipment_defect",
      entity_id: id.toString(),
      details: updates,
    });

    return defect;
  }
);
