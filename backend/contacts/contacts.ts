import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requireRole } from "../auth/rbac";
import { logActivity } from "../logging/logger";
import { canReadContacts, cleanContact, type ContactInput } from "../lib/contactsRules";

// Station contacts (John, Nov 2026): the regular phone numbers from the office
// whiteboard — Control, staffing, the other stations — in one page. Everyone
// on station reads it (firefighters once its switch is on); a Watch or Crew
// Commander keeps it up to date. The numbers live in the database only.
//
// The paths start /api because the page itself is at /contacts: a GET on the
// same address would answer a refresh or a shared link with JSON, not the app.

export interface StationContact {
  id: number;
  section: string;
  name: string;
  detail: string | null;
  numbers: string;
  note: string | null;
  position: number;
  updated_at: string;
}

interface ListContactsResponse {
  contacts: StationContact[];
}

const COLUMNS = `id, section, name, detail, numbers, note, position, updated_at::text AS updated_at`;

async function assertCanRead(): Promise<void> {
  const auth = getAuthData()!;
  const row = await db.rawQueryRow<{ feature_flags: unknown }>(
    `SELECT feature_flags FROM system_settings ORDER BY id DESC LIMIT 1`,
  );
  if (!canReadContacts({ role: auth.role, isAdmin: auth.isAdmin }, row?.feature_flags)) {
    throw APIError.permissionDenied("Contacts isn't switched on yet.");
  }
}

// GET /api/contacts — the whole list, in page order.
export const list = api<void, ListContactsResponse>(
  { auth: true, expose: true, method: "GET", path: "/api/contacts" },
  async () => {
    await assertCanRead();
    const contacts = await db.rawQueryAll<StationContact>(
      `SELECT ${COLUMNS} FROM station_contacts ORDER BY position, id`,
    );
    return { contacts };
  },
);

function cleaned(input: ContactInput) {
  const r = cleanContact(input);
  if ("error" in r) throw APIError.invalidArgument(r.error);
  return r.contact;
}

// POST /api/contacts — add a line (WC/CC). It goes at the end of its section.
export const create = api<ContactInput, StationContact>(
  { auth: true, expose: true, method: "POST", path: "/api/contacts" },
  async (req) => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");
    const c = cleaned(req);
    const row = await insertContact(c, auth.userID);
    await logActivity({ user_id: auth.userID, action: "add_contact", entity_type: "station_contact", entity_id: String(row.id), details: { section: c.section, name: c.name } });
    return row;
  },
);

/**
 * A new line sits after the last line of its section, so a section stays
 * together; a new section goes at the bottom of the page.
 */
async function insertContact(c: ReturnType<typeof cleaned>, userId: string): Promise<StationContact> {
  const last = await db.rawQueryRow<{ position: number | null }>(
    `SELECT MAX(position) AS position FROM station_contacts WHERE LOWER(section) = LOWER($1)`,
    c.section,
  );
  let position: number;
  if (last?.position != null) {
    position = last.position + 1;
    // Make room: everything after this section moves down one.
    await db.rawQueryAll(`UPDATE station_contacts SET position = position + 1 WHERE position >= $1 RETURNING id`, position);
  } else {
    const end = await db.rawQueryRow<{ position: number | null }>(`SELECT MAX(position) AS position FROM station_contacts`);
    position = (end?.position ?? 0) + 1;
  }
  const row = await db.rawQueryRow<StationContact>(
    `INSERT INTO station_contacts (section, name, detail, numbers, note, position, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING ${COLUMNS}`,
    c.section, c.name, c.detail, c.numbers, c.note, position, userId,
  );
  if (!row) throw APIError.internal("Couldn't save the contact.");
  return row;
}

interface AddManyRequest {
  contacts: ContactInput[];
}

interface AddManyResponse {
  added: number;
}

// POST /api/contacts/bulk — add a whole list in one go (WC/CC), e.g. every
// station's direct line. All or nothing: one bad line and none are saved.
export const addMany = api<AddManyRequest, AddManyResponse>(
  { auth: true, expose: true, method: "POST", path: "/api/contacts/bulk" },
  async (req) => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");
    if (!Array.isArray(req.contacts) || req.contacts.length === 0) throw APIError.invalidArgument("No contacts to add.");
    if (req.contacts.length > 200) throw APIError.invalidArgument("That's too many at once (200 at most).");
    const all = req.contacts.map((c, i) => {
      const r = cleanContact(c);
      if ("error" in r) throw APIError.invalidArgument(`Line ${i + 1}: ${r.error}`);
      return r.contact;
    });
    for (const c of all) await insertContact(c, auth.userID);
    await logActivity({ user_id: auth.userID, action: "add_contacts", entity_type: "station_contact", entity_id: "bulk", details: { added: all.length } });
    return { added: all.length };
  },
);

interface UpdateContactRequest extends ContactInput {
  id: number;
}

// PATCH /api/contacts/:id — change a line (WC/CC).
export const update = api<UpdateContactRequest, StationContact>(
  { auth: true, expose: true, method: "PATCH", path: "/api/contacts/:id" },
  async (req) => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");
    const c = cleaned(req);
    const row = await db.rawQueryRow<StationContact>(
      `UPDATE station_contacts
          SET section = $1, name = $2, detail = $3, numbers = $4, note = $5, updated_by = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING ${COLUMNS}`,
      c.section, c.name, c.detail, c.numbers, c.note, auth.userID, req.id,
    );
    if (!row) throw APIError.notFound("That contact isn't there any more.");
    await logActivity({ user_id: auth.userID, action: "update_contact", entity_type: "station_contact", entity_id: String(req.id), details: { section: c.section, name: c.name } });
    return row;
  },
);

// DELETE /api/contacts/:id — take a line off (WC/CC).
export const remove = api<{ id: number }, void>(
  { auth: true, expose: true, method: "DELETE", path: "/api/contacts/:id" },
  async (req) => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");
    const row = await db.rawQueryRow<{ name: string }>(`DELETE FROM station_contacts WHERE id = $1 RETURNING name`, req.id);
    if (!row) throw APIError.notFound("That contact isn't there any more.");
    await logActivity({ user_id: auth.userID, action: "delete_contact", entity_type: "station_contact", entity_id: String(req.id), details: { name: row.name } });
  },
);
