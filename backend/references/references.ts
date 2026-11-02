import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requireRole } from "../auth/rbac";
import { cleanRoutineItems, mergeChecklist } from "../lib/routine";
import { REFERENCE_CADENCES } from "../lib/referenceRota";
import type { ChecklistItem } from "../task/types";

// Watch references (Nov 2026). Each watch holds one of five station
// references for two years (and is secondary on the next one, covering it
// when the main watch is off); ref 0 is the duties every watch has. The
// wording is the station's own, edited here by WCs and CCs.

export interface ReferenceSection {
  heading: string;
  items: string[];
}

/** A reference's monthly / quarterly / annual card of checks. */
export interface ReferenceCard {
  id: number;
  cadence: string;
  items: string[];
  active: boolean;
  /** A web link shown on the card, e.g. the shared spreadsheet it's about. */
  link: string | null;
}

export interface StationReference {
  ref: number;
  title: string;
  sections: ReferenceSection[];
  updated_at: string;
  cards: ReferenceCard[];
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d);
const parseSections = (v: unknown): ReferenceSection[] => {
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  return Array.isArray(arr) ? arr : [];
};

// GET /station-references — every reference's title and duties.
export const listReferences = api(
  { auth: true, expose: true, method: "GET", path: "/station-references" },
  async (): Promise<{ references: StationReference[] }> => {
    const rows = await db.rawQueryAll<{ ref: number; title: string; sections: unknown; updated_at: Date | string }>(
      `SELECT ref, title, sections, updated_at FROM station_references ORDER BY ref`
    );
    const cards = await referenceCards();
    return {
      references: rows.map((r) => ({
        ref: r.ref, title: r.title, sections: parseSections(r.sections), updated_at: iso(r.updated_at),
        cards: cards.filter((c) => c.ref === r.ref).map(({ ref: _, ...c }) => c),
      })),
    };
  }
);

// PUT /station-references/:ref — set a reference's title and duties (WC/CC).
export const saveReference = api(
  { auth: true, expose: true, method: "PUT", path: "/station-references/:ref" },
  async (req: { ref: number; title: string; sections: ReferenceSection[] }): Promise<StationReference> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");
    const ref = Number(req.ref);
    if (!Number.isInteger(ref) || ref < 0 || ref > 5) throw APIError.invalidArgument("References run from 1 to 5 (0 = all watches).");
    const title = String(req.title ?? "").trim().slice(0, 120);
    if (!title) throw APIError.invalidArgument("Give the reference a title.");
    const sections = (Array.isArray(req.sections) ? req.sections : []).slice(0, 20).map((s) => ({
      heading: String(s.heading ?? "").trim().slice(0, 120),
      items: (Array.isArray(s.items) ? s.items : []).map((i) => String(i ?? "").trim().slice(0, 600)).filter(Boolean).slice(0, 40),
    })).filter((s) => s.heading || s.items.length);

    const row = await db.rawQueryRow<{ ref: number; title: string; sections: unknown; updated_at: Date | string }>(
      `INSERT INTO station_references (ref, title, sections, updated_by, updated_at)
       VALUES ($1, $2, $3::text::jsonb, $4, NOW())
       ON CONFLICT (ref) DO UPDATE SET title = EXCLUDED.title, sections = EXCLUDED.sections,
         updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING ref, title, sections, updated_at`,
      ref, title, JSON.stringify(sections), auth.userID
    );
    if (!row) throw APIError.internal("Couldn't save the reference");
    const cards = (await referenceCards()).filter((c) => c.ref === row.ref).map(({ ref: _, ...c }) => c);
    return { ref: row.ref, title: row.title, sections: parseSections(row.sections), updated_at: iso(row.updated_at), cards };
  }
);

const CADENCE_RRULE: Record<string, string> = {
  monthly: "FREQ=MONTHLY;INTERVAL=1",
  quarterly: "FREQ=MONTHLY;INTERVAL=3",
  annual: "FREQ=YEARLY;INTERVAL=1",
};
const CADENCE_NAME: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" };
const ORDER: Record<string, number> = { monthly: 0, quarterly: 1, annual: 2 };

const checklistOf = (v: unknown): ChecklistItem[] => {
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  return Array.isArray(arr) ? arr : [];
};

async function referenceCards(): Promise<(ReferenceCard & { ref: number })[]> {
  const rows = await db.rawQueryAll<{ id: number; reference_no: number; reference_cadence: string; checklist: unknown; is_active: boolean; link_url: string | null }>(
    `SELECT id, reference_no, reference_cadence, checklist, is_active, link_url FROM task_templates WHERE reference_no IS NOT NULL`
  );
  return rows
    .map((r) => ({
      id: r.id, ref: r.reference_no, cadence: r.reference_cadence,
      items: checklistOf(r.checklist).map((i) => i.label), active: r.is_active, link: r.link_url,
    }))
    .sort((a, b) => a.ref - b.ref || ORDER[a.cadence] - ORDER[b.cadence]);
}

// PUT /station-references/:ref/cards — set a reference's monthly, quarterly
// and annual cards of checks (WC/CC); reference 0's go to every watch. A card
// with no checks is switched off.
// Cards already on a watch's board pick up the change; ticks are kept.
export const saveReferenceCards = api(
  { auth: true, expose: true, method: "PUT", path: "/station-references/:ref/cards" },
  async (req: { ref: number; cards: { cadence: string; items: string[]; link?: string | null }[] }): Promise<{ cards: ReferenceCard[] }> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");
    const ref = Number(req.ref);
    if (!Number.isInteger(ref) || ref < 0 || ref > 5) throw APIError.invalidArgument("Reference cards are for references 1 to 5, or 0 for all watches.");

    for (const card of req.cards ?? []) {
      const cadence = String(card.cadence);
      if (!(REFERENCE_CADENCES as string[]).includes(cadence)) throw APIError.invalidArgument(`Unknown frequency "${cadence}".`);
      const checklist = cleanRoutineItems(Array.isArray(card.items) ? card.items : []);
      const name = `${ref === 0 ? "All watches" : `Reference ${ref}`} · ${CADENCE_NAME[cadence]}`;
      // Left out = unchanged; empty = no link. Web links only.
      const setLink = card.link !== undefined;
      const link = String(card.link ?? "").trim() || null;
      if (link && (!/^https:\/\/\S+$/i.test(link) || link.length > 2000)) {
        throw APIError.invalidArgument("The link must be a web address starting https://");
      }

      const row = await db.rawQueryRow<{ id: number }>(
        `INSERT INTO task_templates
           (name, description, title_template, category, priority, checklist, rrule, created_by, per_shift, is_active,
            reference_no, reference_cadence, reference_month, link_url)
         VALUES ($1, NULL, $1, 'Other', 'Med', $2, $3, $4, false, $5, $6, $7, NULL, $8)
         ON CONFLICT (reference_no, reference_cadence) WHERE reference_no IS NOT NULL
         DO UPDATE SET checklist = EXCLUDED.checklist, is_active = EXCLUDED.is_active, reference_month = NULL,
           link_url = CASE WHEN $9::boolean THEN EXCLUDED.link_url ELSE task_templates.link_url END, updated_at = NOW()
         RETURNING id`,
        name, JSON.stringify(checklist), CADENCE_RRULE[cadence], auth.userID, checklist.length > 0, ref, cadence, link, setLink
      );
      if (!row) continue;

      // Cards on the board now: new checks arrive, removed ones go unless ticked.
      const open = await db.rawQueryAll<{ id: number; checklist: unknown }>(
        `SELECT t.id, t.checklist FROM tasks t JOIN task_template_instances i ON i.task_id = t.id
         WHERE i.template_id = $1 AND t.status NOT IN ('Done', 'Missed')`,
        row.id
      );
      for (const c of open) {
        const next = mergeChecklist(checklistOf(c.checklist), checklist);
        await db.rawExec(`UPDATE tasks SET checklist = $1, updated_at = NOW() WHERE id = $2`, JSON.stringify(next), c.id);
      }
    }
    return { cards: (await referenceCards()).filter((c) => c.ref === ref).map(({ ref: _, ...c }) => c) };
  }
);
