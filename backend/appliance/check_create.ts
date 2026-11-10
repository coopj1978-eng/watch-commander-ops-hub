import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { slotAt } from "../lib/shiftRota";
import { statusAfterTick, tickJ4Lines, type TickItem } from "../lib/j4Tick";
import type { StartCheckRequest, EquipmentCheck, EquipmentCheckItem } from "./types";

interface StartCheckResponse {
  check: EquipmentCheck;
  items: EquipmentCheckItem[];
  /** Lines this check added to the J4 board. */
  defects_created: number;
  /** Missing or defective items that were on the board already (no second line). */
  already_on_board: number;
  /** J4 lines this check ticked on the shift's task cards. */
  task_lines_ticked: string[];
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
    let alreadyOnBoard = 0;

    for (const item of req.items) {
      const checkItem = await db.queryRow<EquipmentCheckItem>`
        INSERT INTO equipment_check_items (check_id, equipment_item_id, status, quantity_checked, notes)
        VALUES (${check.id}, ${item.equipment_item_id}, ${item.status}, ${item.quantity_checked}, ${item.notes || null})
        RETURNING *
      `;

      if (checkItem) {
        checkItems.push(checkItem);

        // Missing or defective: onto the J4 board — once. The same item is
        // found missing every shift until it's back, and that's still one line.
        if (item.status === "Defective" || item.status === "Missing") {
          const onBoard = await db.queryRow<{ id: number }>`
            SELECT id FROM equipment_defects
            WHERE equipment_item_id = ${item.equipment_item_id} AND status <> 'Resolved'
            LIMIT 1
          `;
          if (onBoard) {
            alreadyOnBoard++;
          } else {
            await db.exec`
              INSERT INTO equipment_defects (check_item_id, equipment_item_id, appliance_id, reported_by, title, description, status, watch)
              VALUES (${checkItem.id}, ${item.equipment_item_id}, ${req.appliance_id}, ${auth.userID},
                      ${item.status === "Missing" ? "Missing" : "Defective"}, ${(item.notes ?? "").trim()}, 'Open', ${auth.watchUnit || null})
            `;
            defectsCreated++;
          }
        }
      }
    }

    // Tick the J4 line on this shift's cards. Never fails the check itself.
    let ticked: string[] = [];
    try {
      ticked = await tickShiftCards(auth.userID);
    } catch (err) {
      console.error("J4 check: couldn't tick the shift card:", err);
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
        already_on_board: alreadyOnBoard,
        task_lines_ticked: ticked,
      },
    });

    return {
      check: { ...check, status: "Complete" as const, completed_at: new Date() },
      items: checkItems,
      defects_created: defectsCreated,
      already_on_board: alreadyOnBoard,
      task_lines_ticked: ticked,
    };
  }
);

/**
 * The station's routine cards for the shift on now carry a line per J4 check
 * ("J4 check – B10P1"). Tick the ones whose appliances have been checked this
 * shift, and move the card on as a tick by hand would.
 */
async function tickShiftCards(userId: string): Promise<string[]> {
  const slot = slotAt(new Date());

  const appliances = await db.queryAll<{ call_sign: string; has_kit: boolean; checked: boolean }>`
    SELECT a.call_sign,
           EXISTS (SELECT 1 FROM equipment_items e WHERE e.appliance_id = a.id AND e.active) AS has_kit,
           EXISTS (SELECT 1 FROM equipment_checks c
                    WHERE c.appliance_id = a.id AND c.status = 'Complete' AND c.completed_at >= ${slot.start}) AS checked
    FROM appliances a
    WHERE a.active
  `;
  const who = await db.queryRow<{ name: string | null }>`SELECT name FROM users WHERE id = ${userId}`;

  // This shift's routine cards still open: due by the end of the shift.
  const cards = await db.queryAll<{ id: number; status: string; checklist: unknown }>`
    SELECT id, status, checklist FROM tasks
    WHERE source_type = 'template'
      AND status NOT IN ('Done', 'Missed')
      AND due_at > NOW() AND due_at <= ${slot.end}
      AND checklist::text ILIKE '%J4 check%'
  `;

  const ticked: string[] = [];
  for (const card of cards) {
    const raw = typeof card.checklist === "string" ? JSON.parse(card.checklist) : card.checklist;
    if (!Array.isArray(raw)) continue;
    const result = tickJ4Lines(raw as TickItem[], {
      callSigns: appliances.map((a) => a.call_sign),
      withKit: appliances.filter((a) => a.has_kit).map((a) => a.call_sign),
      checked: appliances.filter((a) => a.checked).map((a) => a.call_sign),
      who: { id: userId, name: who?.name ?? null },
    });
    if (result.ticked.length === 0) continue;

    const next = statusAfterTick(card.status, result.checklist);
    if (next === "Done") {
      await db.rawQueryRow(
        `UPDATE tasks SET checklist = $1, status = 'Done', completed_at = NOW(), completed_by = $2, updated_at = NOW() WHERE id = $3 RETURNING id`,
        JSON.stringify(result.checklist), userId, card.id,
      );
    } else if (next === "InProgress") {
      await db.rawQueryRow(
        `UPDATE tasks SET checklist = $1, status = 'InProgress', updated_at = NOW() WHERE id = $2 RETURNING id`,
        JSON.stringify(result.checklist), card.id,
      );
    } else {
      await db.rawQueryRow(
        `UPDATE tasks SET checklist = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
        JSON.stringify(result.checklist), card.id,
      );
    }
    ticked.push(...result.ticked);
  }
  return ticked;
}
