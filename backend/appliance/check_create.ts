import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { StartCheckRequest, EquipmentCheck, EquipmentCheckItem, CheckItemInput } from "./types";

interface StartCheckResponse {
  check: EquipmentCheck;
  items: EquipmentCheckItem[];
  defects_created: number;
}

export const startCheck = api<StartCheckRequest, StartCheckResponse>(
  { auth: true, expose: true, method: "POST", path: "/appliances/checks" },
  async (req) => {
    const auth = getAuthData()!;

    // Create the check record
    const check = await db.queryRow<EquipmentCheck>`
      INSERT INTO equipment_checks (appliance_id, checked_by, watch, status, notes)
      VALUES (${req.appliance_id}, ${auth.userID}, ${req.watch}, 'Complete', ${req.notes || null})
      RETURNING *
    `;

    if (!check) {
      throw APIError.internal("Failed to create equipment check");
    }

    // Mark as complete with timestamp
    await db.exec`UPDATE equipment_checks SET completed_at = NOW(), status = 'Complete' WHERE id = ${check.id}`;

    // Insert all check items
    const checkItems: EquipmentCheckItem[] = [];
    let defectsCreated = 0;

    for (const item of req.items) {
      const checkItem = await db.queryRow<EquipmentCheckItem>`
        INSERT INTO equipment_check_items (check_id, equipment_item_id, status, quantity_checked, notes)
        VALUES (${check.id}, ${item.equipment_item_id}, ${item.status}, ${item.quantity_checked}, ${item.notes || null})
        RETURNING *
      `;

      if (checkItem) {
        checkItems.push(checkItem);

        // Auto-create defect for defective/missing items
        if (item.status === "Defective" || item.status === "Missing") {
          const description = item.notes || `Item marked as ${item.status} during J4 check`;
          await db.exec`
            INSERT INTO equipment_defects (check_item_id, equipment_item_id, appliance_id, reported_by, description, status)
            VALUES (${checkItem.id}, ${item.equipment_item_id}, ${req.appliance_id}, ${auth.userID}, ${description}, 'Open')
          `;
          defectsCreated++;
        }
      }
    }

    await logActivity({
      user_id: auth.userID,
      action: "complete_j4_check",
      entity_type: "equipment_check",
      entity_id: check.id.toString(),
      details: {
        appliance_id: req.appliance_id,
        watch: req.watch,
        total_items: req.items.length,
        defects_found: defectsCreated,
      },
    });

    return {
      check: { ...check, status: "Complete" as const, completed_at: new Date() },
      items: checkItems,
      defects_created: defectsCreated,
    };
  }
);
