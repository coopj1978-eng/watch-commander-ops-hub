import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { Inspection, InspectionType, InspectionStatus, InspectionPriority } from "./types";

interface CreateInspectionParams {
  type: InspectionType;
  address: string;
  priority?: InspectionPriority;
  scheduled_for: Date;
  assigned_crew_ids?: string[];
  status?: InspectionStatus;
  notes?: string;
}

export const create = api(
  { auth: true, expose: true, method: "POST", path: "/inspections" },
  async (req: CreateInspectionParams): Promise<Inspection> => {
    const auth = getAuthData()!;

    const inspection = await db.rawQueryRow<Inspection>(`
      INSERT INTO inspections (
        type, address, priority, scheduled_for, assigned_crew_ids, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, 
      req.type,
      req.address,
      req.priority || "medium",
      req.scheduled_for,
      req.assigned_crew_ids || [],
      req.status || "Planned",
      req.notes || ""
    );

    if (!inspection) {
      throw new Error("Failed to create inspection");
    }

    await logActivity({
      user_id: auth.userID,
      action: "create_inspection",
      entity_type: "inspection",
      entity_id: inspection.id.toString(),
      details: { type: inspection.type, address: inspection.address },
    });

    return inspection;
  }
);
