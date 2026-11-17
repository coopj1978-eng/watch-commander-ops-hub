import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { canReadSwitched, cleanGuide, cleanLink, type GuideInput, type LinkInput } from "../lib/libraryRules";

// The station's library (John, Nov 2026): how-to guides and regular links,
// both of which lived on Notion pages. Organised under headings; the admin
// writes them, everyone else reads. Guides are for Watch and Crew Commanders
// until their firefighter switch is turned on; links have their own switch.
//
// Paths start /api because the pages themselves are at /guides and /links: a
// GET on the page's own address would answer a refresh with JSON.

type Kind = "guides" | "links";
const TABLE: Record<Kind, string> = { guides: "guides", links: "station_links" };

async function assertCanRead(kind: Kind): Promise<void> {
  const auth = getAuthData()!;
  const row = await db.rawQueryRow<{ feature_flags: unknown }>(
    `SELECT feature_flags FROM system_settings ORDER BY id DESC LIMIT 1`,
  );
  if (!canReadSwitched({ role: auth.role, isAdmin: auth.isAdmin }, row?.feature_flags, kind)) {
    throw APIError.permissionDenied(kind === "guides" ? "Guides aren't switched on yet." : "Links aren't switched on yet.");
  }
}

/** Only the admin changes the library: it's the whole station's, every watch. */
function assertAdmin(): string {
  const auth = getAuthData()!;
  if (!auth.isAdmin) throw APIError.permissionDenied("Only the admin can change this.");
  return auth.userID;
}

/** After the last line of its section, so a section stays together; a new section goes last. */
async function nextPosition(kind: Kind, section: string): Promise<number> {
  const table = TABLE[kind];
  const last = await db.rawQueryRow<{ position: number | null }>(
    `SELECT MAX(position) AS position FROM ${table} WHERE LOWER(section) = LOWER($1)`, section,
  );
  if (last?.position != null) {
    const position = last.position + 1;
    await db.rawQueryAll(`UPDATE ${table} SET position = position + 1 WHERE position >= $1 RETURNING id`, position);
    return position;
  }
  const end = await db.rawQueryRow<{ position: number | null }>(`SELECT MAX(position) AS position FROM ${table}`);
  return (end?.position ?? 0) + 1;
}

// ── Links ────────────────────────────────────────────────────────────────────

export interface StationLink {
  id: number;
  section: string;
  title: string;
  url: string;
  note: string | null;
  position: number;
}

const LINK_COLS = `id, section, title, url, note, position`;

export const listLinks = api<void, { links: StationLink[] }>(
  { auth: true, expose: true, method: "GET", path: "/api/links" },
  async () => {
    await assertCanRead("links");
    return { links: await db.rawQueryAll<StationLink>(`SELECT ${LINK_COLS} FROM station_links ORDER BY position, id`) };
  },
);

async function insertLink(input: LinkInput, userId: string): Promise<StationLink> {
  const r = cleanLink(input);
  if ("error" in r) throw APIError.invalidArgument(r.error);
  const l = r.link;
  const row = await db.rawQueryRow<StationLink>(
    `INSERT INTO station_links (section, title, url, note, position, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING ${LINK_COLS}`,
    l.section, l.title, l.url, l.note, await nextPosition("links", l.section), userId,
  );
  if (!row) throw APIError.internal("Couldn't save the link.");
  return row;
}

export const createLink = api<LinkInput, StationLink>(
  { auth: true, expose: true, method: "POST", path: "/api/links" },
  async (req) => {
    const userId = assertAdmin();
    const row = await insertLink(req, userId);
    await logActivity({ user_id: userId, action: "add_link", entity_type: "station_link", entity_id: String(row.id), details: { title: row.title } });
    return row;
  },
);

export const addLinks = api<{ links: LinkInput[] }, { added: number }>(
  { auth: true, expose: true, method: "POST", path: "/api/links/bulk" },
  async (req) => {
    const userId = assertAdmin();
    if (!Array.isArray(req.links) || req.links.length === 0 || req.links.length > 200) throw APIError.invalidArgument("Send between 1 and 200 links.");
    req.links.forEach((l, i) => { const r = cleanLink(l); if ("error" in r) throw APIError.invalidArgument(`Line ${i + 1}: ${r.error}`); });
    for (const l of req.links) await insertLink(l, userId);
    await logActivity({ user_id: userId, action: "add_links", entity_type: "station_link", entity_id: "bulk", details: { added: req.links.length } });
    return { added: req.links.length };
  },
);

export const updateLink = api<LinkInput & { id: number }, StationLink>(
  { auth: true, expose: true, method: "PATCH", path: "/api/links/:id" },
  async (req) => {
    const userId = assertAdmin();
    const r = cleanLink(req);
    if ("error" in r) throw APIError.invalidArgument(r.error);
    const l = r.link;
    const row = await db.rawQueryRow<StationLink>(
      `UPDATE station_links SET section = $1, title = $2, url = $3, note = $4, updated_by = $5, updated_at = NOW()
        WHERE id = $6 RETURNING ${LINK_COLS}`,
      l.section, l.title, l.url, l.note, userId, req.id,
    );
    if (!row) throw APIError.notFound("That link isn't there any more.");
    await logActivity({ user_id: userId, action: "update_link", entity_type: "station_link", entity_id: String(req.id), details: { title: l.title } });
    return row;
  },
);

export const removeLink = api<{ id: number }, void>(
  { auth: true, expose: true, method: "DELETE", path: "/api/links/:id" },
  async (req) => {
    const userId = assertAdmin();
    const row = await db.rawQueryRow<{ title: string }>(`DELETE FROM station_links WHERE id = $1 RETURNING title`, req.id);
    if (!row) throw APIError.notFound("That link isn't there any more.");
    await logActivity({ user_id: userId, action: "delete_link", entity_type: "station_link", entity_id: String(req.id), details: { title: row.title } });
  },
);

// ── Guides ───────────────────────────────────────────────────────────────────

export interface Guide {
  id: number;
  section: string;
  title: string;
  summary: string | null;
  body: string;
  position: number;
  updated_at: string;
}

const GUIDE_COLS = `id, section, title, summary, body, position, updated_at::text AS updated_at`;

export const listGuides = api<void, { guides: Guide[] }>(
  { auth: true, expose: true, method: "GET", path: "/api/guides" },
  async () => {
    await assertCanRead("guides");
    return { guides: await db.rawQueryAll<Guide>(`SELECT ${GUIDE_COLS} FROM guides ORDER BY position, id`) };
  },
);

async function insertGuide(input: GuideInput, userId: string): Promise<Guide> {
  const r = cleanGuide(input);
  if ("error" in r) throw APIError.invalidArgument(r.error);
  const g = r.guide;
  const row = await db.rawQueryRow<Guide>(
    `INSERT INTO guides (section, title, summary, body, position, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING ${GUIDE_COLS}`,
    g.section, g.title, g.summary, g.body, await nextPosition("guides", g.section), userId,
  );
  if (!row) throw APIError.internal("Couldn't save the guide.");
  return row;
}

export const createGuide = api<GuideInput, Guide>(
  { auth: true, expose: true, method: "POST", path: "/api/guides" },
  async (req) => {
    const userId = assertAdmin();
    const row = await insertGuide(req, userId);
    await logActivity({ user_id: userId, action: "add_guide", entity_type: "guide", entity_id: String(row.id), details: { title: row.title } });
    return row;
  },
);

export const addGuides = api<{ guides: GuideInput[] }, { added: number }>(
  { auth: true, expose: true, method: "POST", path: "/api/guides/bulk" },
  async (req) => {
    const userId = assertAdmin();
    if (!Array.isArray(req.guides) || req.guides.length === 0 || req.guides.length > 100) throw APIError.invalidArgument("Send between 1 and 100 guides.");
    req.guides.forEach((g, i) => { const r = cleanGuide(g); if ("error" in r) throw APIError.invalidArgument(`Guide ${i + 1}: ${r.error}`); });
    for (const g of req.guides) await insertGuide(g, userId);
    await logActivity({ user_id: userId, action: "add_guides", entity_type: "guide", entity_id: "bulk", details: { added: req.guides.length } });
    return { added: req.guides.length };
  },
);

export const updateGuide = api<GuideInput & { id: number }, Guide>(
  { auth: true, expose: true, method: "PATCH", path: "/api/guides/:id" },
  async (req) => {
    const userId = assertAdmin();
    const r = cleanGuide(req);
    if ("error" in r) throw APIError.invalidArgument(r.error);
    const g = r.guide;
    const row = await db.rawQueryRow<Guide>(
      `UPDATE guides SET section = $1, title = $2, summary = $3, body = $4, updated_by = $5, updated_at = NOW()
        WHERE id = $6 RETURNING ${GUIDE_COLS}`,
      g.section, g.title, g.summary, g.body, userId, req.id,
    );
    if (!row) throw APIError.notFound("That guide isn't there any more.");
    // The log says which guide changed, never its wording.
    await logActivity({ user_id: userId, action: "update_guide", entity_type: "guide", entity_id: String(req.id), details: { title: g.title } });
    return row;
  },
);

export const removeGuide = api<{ id: number }, void>(
  { auth: true, expose: true, method: "DELETE", path: "/api/guides/:id" },
  async (req) => {
    const userId = assertAdmin();
    const row = await db.rawQueryRow<{ title: string }>(`DELETE FROM guides WHERE id = $1 RETURNING title`, req.id);
    if (!row) throw APIError.notFound("That guide isn't there any more.");
    await logActivity({ user_id: userId, action: "delete_guide", entity_type: "guide", entity_id: String(req.id), details: { title: row.title } });
  },
);

// ── Sections (a heading shared by its lines) ─────────────────────────────────

interface SectionRequest {
  /** "guides" or "links". */
  kind: string;
  section: string;
  /** The new heading, when renaming. */
  to?: string;
}

function kindOf(raw: string): Kind {
  if (raw === "guides" || raw === "links") return raw;
  throw APIError.invalidArgument("kind must be guides or links");
}

// POST /api/library/sections/rename — renaming to a heading that exists joins the two.
export const renameSection = api<SectionRequest, { lines: number }>(
  { auth: true, expose: true, method: "POST", path: "/api/library/sections/rename" },
  async (req) => {
    const userId = assertAdmin();
    const kind = kindOf(req.kind);
    const to = (req.to ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!req.section?.trim()) throw APIError.invalidArgument("Which section?");
    if (!to) throw APIError.invalidArgument("Give the section a heading.");
    const rows = await db.rawQueryAll<{ id: number }>(
      `UPDATE ${TABLE[kind]} SET section = $1, updated_by = $2, updated_at = NOW() WHERE LOWER(section) = LOWER($3) RETURNING id`,
      to, userId, req.section.trim(),
    );
    if (rows.length === 0) throw APIError.notFound("That section isn't there any more.");
    await logActivity({ user_id: userId, action: "rename_library_section", entity_type: kind, entity_id: "section", details: { from: req.section, to, lines: rows.length } });
    return { lines: rows.length };
  },
);

// POST /api/library/sections/remove — the section and everything in it.
export const removeSection = api<SectionRequest, { lines: number }>(
  { auth: true, expose: true, method: "POST", path: "/api/library/sections/remove" },
  async (req) => {
    const userId = assertAdmin();
    const kind = kindOf(req.kind);
    if (!req.section?.trim()) throw APIError.invalidArgument("Which section?");
    const rows = await db.rawQueryAll<{ id: number }>(
      `DELETE FROM ${TABLE[kind]} WHERE LOWER(section) = LOWER($1) RETURNING id`, req.section.trim(),
    );
    if (rows.length === 0) throw APIError.notFound("That section isn't there any more.");
    await logActivity({ user_id: userId, action: "delete_library_section", entity_type: kind, entity_id: "section", details: { section: req.section, lines: rows.length } });
    return { lines: rows.length };
  },
);
