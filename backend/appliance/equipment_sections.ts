import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { inSection, reordered, sectionNameProblem, type SectionRef } from "../lib/kitSections";

// Changes to a whole heading of an appliance's kit list — a locker (or cab)
// or one of its shelves — and to the order of the list. Changing one item is
// in equipment_update.ts.

interface KitRow { id: number; locker: string | null; shelf: string | null }

async function activeKit(applianceId: number): Promise<KitRow[]> {
  return db.queryAll<KitRow>`
    SELECT id, locker, shelf FROM equipment_items
    WHERE appliance_id = ${applianceId} AND active
    ORDER BY sort_order, category, name
  `;
}

interface RenameSectionRequest extends SectionRef {
  appliance_id: number;
  new_name: string;
}

/** Renames a locker (or cab), or one shelf of it. WC/CC. */
export const renameSection = api<RenameSectionRequest, { updated: number }>(
  { auth: true, expose: true, method: "POST", path: "/appliances/equipment/sections/rename" },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC" && auth.role !== "CC") {
      throw APIError.permissionDenied("Only Watch/Crew Commanders can change the kit list");
    }
    const problem = sectionNameProblem(req.new_name);
    if (problem) throw APIError.invalidArgument(problem);
    const name = req.new_name.trim();

    const ref: SectionRef = { locker: req.locker, ...(req.shelf !== undefined ? { shelf: req.shelf } : {}) };
    const ids = (await activeKit(req.appliance_id)).filter((i) => inSection(i, ref)).map((i) => i.id);
    if (ids.length === 0) throw APIError.notFound("Nothing is kept under that heading.");

    if (req.shelf !== undefined) {
      await db.rawExec(`UPDATE equipment_items SET shelf = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, name, ids);
    } else {
      await db.rawExec(`UPDATE equipment_items SET locker = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, name, ids);
    }

    await logActivity({
      user_id: auth.userID,
      action: "rename_kit_section",
      entity_type: "appliance",
      entity_id: req.appliance_id.toString(),
      details: { locker: req.locker, shelf: req.shelf, new_name: name, items: ids.length },
    });
    return { updated: ids.length };
  }
);

interface RemoveSectionRequest extends SectionRef {
  appliance_id: number;
}

/**
 * Takes a whole locker, or one shelf, off the kit list (WC only, as removing
 * one item is). Items are kept in past checks; they just stop being checked.
 */
export const removeSection = api<RemoveSectionRequest, { removed: number }>(
  { auth: true, expose: true, method: "POST", path: "/appliances/equipment/sections/remove" },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC") {
      throw APIError.permissionDenied("Only Watch Commanders can remove equipment");
    }
    const ref: SectionRef = { locker: req.locker, ...(req.shelf !== undefined ? { shelf: req.shelf } : {}) };
    const ids = (await activeKit(req.appliance_id)).filter((i) => inSection(i, ref)).map((i) => i.id);
    if (ids.length === 0) throw APIError.notFound("Nothing is kept under that heading.");

    await db.rawExec(`UPDATE equipment_items SET active = false, updated_at = NOW() WHERE id = ANY($1::int[])`, ids);

    await logActivity({
      user_id: auth.userID,
      action: "remove_kit_section",
      entity_type: "appliance",
      entity_id: req.appliance_id.toString(),
      details: { locker: req.locker, shelf: req.shelf, items: ids.length },
    });
    return { removed: ids.length };
  }
);

interface ReorderRequest {
  appliance_id: number;
  /** Every item on the list, in its new order. */
  ids: number[];
}

/** Puts the appliance's kit list in a new order. WC/CC. */
export const reorderEquipment = api<ReorderRequest, { ordered: number }>(
  { auth: true, expose: true, method: "POST", path: "/appliances/equipment/reorder" },
  async (req) => {
    const auth = getAuthData()!;
    if (auth.role !== "WC" && auth.role !== "CC") {
      throw APIError.permissionDenied("Only Watch/Crew Commanders can change the kit list");
    }
    const current = (await activeKit(req.appliance_id)).map((i) => i.id);
    const next = reordered(current, req.ids);
    if (next.length === 0) return { ordered: 0 };

    await db.rawExec(
      `UPDATE equipment_items e SET sort_order = o.n * 10, updated_at = NOW()
       FROM unnest($1::int[]) WITH ORDINALITY AS o(id, n)
       WHERE e.id = o.id AND e.appliance_id = $2`,
      next, req.appliance_id
    );
    return { ordered: next.length };
  }
);
