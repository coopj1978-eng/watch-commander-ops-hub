import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/rbac";
import db from "../db";
import { createActivityLog } from "./create_activity_log";

export interface AssetReassignment {
  tasks: boolean;
  inspections: boolean;
  absences: boolean;
}

export interface ReassignAssetsRequest {
  userId: string;
  replacementUserId: string;
  assets: AssetReassignment;
}

export interface ReassignmentPreview {
  taskCount: number;
  inspectionCount: number;
  absenceCount: number;
}

export const getReassignmentPreview = api(
  { method: "GET", path: "/api/admin/reassign/:userId/preview", expose: true, auth: true },
  async ({ userId }: { userId: string }): Promise<ReassignmentPreview> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC");

    const taskCount = await db.rawQueryRow<{ count: number }>(
      `SELECT COUNT(*) as count FROM tasks WHERE assigned_to_user_id = $1 AND status != 'Done'`,
      userId
    );

    const inspectionCount = await db.rawQueryRow<{ count: number }>(
      `SELECT COUNT(*) as count FROM inspections WHERE $1 = ANY(assigned_crew_ids) AND status != 'Complete'`,
      userId
    );

    const absenceCount = await db.rawQueryRow<{ count: number }>(
      `SELECT COUNT(*) as count FROM absences WHERE approved_by = $1 AND status = 'pending'`,
      userId
    );

    return {
      taskCount: taskCount?.count || 0,
      inspectionCount: inspectionCount?.count || 0,
      absenceCount: absenceCount?.count || 0,
    };
  }
);

export const reassignAssets = api(
  { method: "POST", path: "/api/admin/reassign", expose: true, auth: true },
  async ({ userId, replacementUserId, assets }: ReassignAssetsRequest): Promise<void> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC");

    const userRow = await db.rawQueryRow<{ id: string }>(
      `SELECT id FROM users WHERE id = $1`,
      userId
    );
    if (!userRow) {
      throw APIError.notFound("User not found");
    }

    const replacementRow = await db.rawQueryRow<{ id: string; is_active: boolean }>(
      `SELECT id, is_active FROM users WHERE id = $1`,
      replacementUserId
    );
    if (!replacementRow) {
      throw APIError.notFound("Replacement user not found");
    }
    if (!replacementRow.is_active) {
      throw APIError.invalidArgument("Replacement user must be active");
    }

    let reassignedCounts = {
      tasks: 0,
      inspections: 0,
      absences: 0,
    };

    if (assets.tasks) {
      await db.exec`
        UPDATE tasks 
        SET assigned_to_user_id = ${replacementUserId}, updated_at = NOW()
        WHERE assigned_to_user_id = ${userId} AND status != 'Done'
      `;
      const countResult = await db.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM tasks WHERE assigned_to_user_id = $1 AND status != 'Done'`,
        replacementUserId
      );
      reassignedCounts.tasks = countResult?.count || 0;
    }

    if (assets.inspections) {
      const inspections = await db.rawQueryAll<{ id: number; assigned_crew_ids: string[] }>(
        `SELECT id, assigned_crew_ids FROM inspections WHERE $1 = ANY(assigned_crew_ids) AND status != 'Complete'`,
        userId
      );

      for (const inspection of inspections) {
        let crewIds: string[] = inspection.assigned_crew_ids || [];
        crewIds = crewIds.filter(id => id !== userId);
        if (!crewIds.includes(replacementUserId)) {
          crewIds.push(replacementUserId);
        }

        await db.exec`
          UPDATE inspections 
          SET assigned_crew_ids = ${crewIds}, updated_at = NOW()
          WHERE id = ${inspection.id}
        `;
        reassignedCounts.inspections++;
      }
    }

    if (assets.absences) {
      await db.exec`
        UPDATE absences 
        SET approved_by = ${replacementUserId}, updated_at = NOW()
        WHERE approved_by = ${userId} AND status = 'pending'
      `;
      const countResult = await db.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM absences WHERE approved_by = $1 AND status = 'pending'`,
        replacementUserId
      );
      reassignedCounts.absences = countResult?.count || 0;
    }

    await createActivityLog({
      actor_user_id: auth.userID,
      action: "reassign_assets",
      entity_type: "user",
      entity_id: userId,
      metadata: {
        replacement_user_id: replacementUserId,
        reassigned: reassignedCounts,
      },
    });
  }
);
