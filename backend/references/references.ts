import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requireRole } from "../auth/rbac";

// Watch references (Nov 2026). Each watch holds one of five station
// references for two years (and is secondary on the next one, covering it
// when the main watch is off); ref 0 is the duties every watch has. The
// wording is the station's own, edited here by WCs and CCs.

export interface ReferenceSection {
  heading: string;
  items: string[];
}

export interface StationReference {
  ref: number;
  title: string;
  sections: ReferenceSection[];
  updated_at: string;
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
    return { references: rows.map((r) => ({ ref: r.ref, title: r.title, sections: parseSections(r.sections), updated_at: iso(r.updated_at) })) };
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
    return { ref: row.ref, title: row.title, sections: parseSections(row.sections), updated_at: iso(row.updated_at) };
  }
);
