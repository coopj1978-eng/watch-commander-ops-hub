// A person's own days on top of their watch's rota (John, 25 Nov 2026) —
// orange days, purple shifts and the odd course or moved leave day. See
// lib/rosterDays.ts for what each kind is, and migration 091.
//
// Who can do what:
//   see     — your own; a WC/CC or admin can see anyone's (they crew the shifts).
//   change  — your own, or a WC/CC/admin for you. When you change your own
//             your watch's WC and CC are told; when they change yours, you are.
//   confirm — an orange day, by you or a WC/CC/admin ("either", John). It
//             becomes an ordinary Orange Day booking; undoing it removes that.
//   import  — admin only: a year's schedule file, payroll number + date + code.

import { api, APIError, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { createNotification, notifyWatchManagers } from "../notification/helpers";
import {
  MANUAL_KINDS, isIsoDay, needsDayNight, niceDay, rosterDayText, sortImport,
  type DayNight, type ImportRow, type RosterKind,
} from "../lib/rosterDays";
import { shiftSlot, watchForSlot } from "../lib/shiftRota";
import { cascadeDeleteAdjustment, insertAdjustmentEvents, loadAdjustment } from "./events";

export interface RosterDay {
  id: number;
  user_id: string;
  user_name: string;
  watch: string | null;
  /** YYYY-MM-DD */
  day: string;
  kind: RosterKind;
  day_night: DayNight | null;
  /** The schedule's own code, when the day came from one. */
  code: string | null;
  source: "import" | "manual";
  /** An orange day that's been confirmed: the Orange Day booking behind it. */
  shift_adjustment_id: number | null;
  confirmed: boolean;
}

const SELECT = `
  SELECT r.id, r.user_id, u.name AS user_name, COALESCE(u.watch_unit, fp.watch) AS watch,
         to_char(r.day, 'YYYY-MM-DD') AS day, r.kind, r.day_night, r.code, r.source,
         r.shift_adjustment_id, (r.shift_adjustment_id IS NOT NULL) AS confirmed
  FROM roster_days r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id`;

type Caller = { userID: string; role: string; isAdmin: boolean };
const isManager = (a: Caller) => a.role === "WC" || a.role === "CC" || a.isAdmin;
const loadDay = (id: number) => db.rawQueryRow<RosterDay>(`${SELECT} WHERE r.id = $1`, id);

async function person(userId: string): Promise<{ id: string; name: string; watch: string | null }> {
  const p = await db.rawQueryRow<{ id: string; name: string; watch: string | null }>(
    `SELECT u.id, u.name, COALESCE(u.watch_unit, fp.watch) AS watch
     FROM users u LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id WHERE u.id = $1`,
    userId,
  );
  if (!p) throw APIError.notFound("That person isn't in the hub.");
  return p;
}

/**
 * Tell the other side about a change: you changed your own → your watch's WC
 * and CC; a WC/CC changed yours → you. Never throws.
 */
async function tell(caller: Caller, who: { id: string; name: string; watch: string | null }, what: string, day: string) {
  try {
    const link = `/calendar?date=${day}`;
    if (caller.userID === who.id) {
      if (!who.watch) return;
      await notifyWatchManagers(who.watch, [caller.userID], {
        type: "general", title: `Calendar change: ${who.name}`, message: `${who.name} ${what}`,
        entity_type: "roster_day", link,
      });
    } else {
      const by = await db.rawQueryRow<{ name: string }>(`SELECT name FROM users WHERE id = $1`, caller.userID);
      await createNotification({
        user_id: who.id, type: "general", title: "Your calendar was changed",
        message: `${by?.name ?? "A manager"} ${what.replace(/\.$/, "")} — on your calendar.`,
        entity_type: "roster_day", link,
      });
    }
  } catch (err) {
    console.error("roster day notification failed:", err);
  }
}

/** Remove the Orange Day booking behind a confirmed day, if there is one. */
async function dropBooking(row: { shift_adjustment_id: number | null }) {
  if (row.shift_adjustment_id == null) return;
  const adj = await loadAdjustment(Number(row.shift_adjustment_id));
  if (adj) await cascadeDeleteAdjustment(adj);
}

// ── See ──────────────────────────────────────────────────────────────────────

interface ListRosterDaysRequest {
  /** YYYY-MM-DD, inclusive. */
  from: Query<string>;
  to: Query<string>;
  /** Someone else's (WC/CC/admin). */
  user_id?: Query<string>;
  /** A whole watch's (WC/CC/admin). */
  watch?: Query<string>;
}

export interface ListRosterDaysResponse { days: RosterDay[] }

export const listRosterDays = api<ListRosterDaysRequest, ListRosterDaysResponse>(
  { auth: true, expose: true, method: "GET", path: "/roster-days" },
  async (req) => {
    const auth = getAuthData()!;
    if (!isIsoDay(req.from) || !isIsoDay(req.to)) throw APIError.invalidArgument("Give the dates as YYYY-MM-DD.");
    if (req.watch) {
      if (!isManager(auth)) throw APIError.permissionDenied("Only a WC or CC can see a watch's orange and purple days.");
      const days = await db.rawQueryAll<RosterDay>(
        `${SELECT} WHERE r.day BETWEEN $1::date AND $2::date AND u.left_at IS NULL
           AND LOWER(COALESCE(u.watch_unit, fp.watch)) = LOWER($3)
         ORDER BY r.day, u.name`,
        req.from, req.to, req.watch,
      );
      return { days };
    }
    const userId = req.user_id || auth.userID;
    if (userId !== auth.userID && !isManager(auth)) throw APIError.permissionDenied("You can only see your own.");
    const days = await db.rawQueryAll<RosterDay>(
      `${SELECT} WHERE r.user_id = $3 AND r.day BETWEEN $1::date AND $2::date ORDER BY r.day`,
      req.from, req.to, userId,
    );
    return { days };
  },
);

// ── Change ───────────────────────────────────────────────────────────────────

interface SaveRosterDayRequest {
  /** Someone else's day (WC/CC/admin). */
  user_id?: string;
  day: string;
  kind: RosterKind;
  day_night?: DayNight;
}

export const saveRosterDay = api<SaveRosterDayRequest, RosterDay>(
  { auth: true, expose: true, method: "POST", path: "/roster-days" },
  async (req) => {
    const auth = getAuthData()!;
    const userId = req.user_id || auth.userID;
    if (userId !== auth.userID && !isManager(auth)) throw APIError.permissionDenied("You can only change your own calendar.");
    if (!isIsoDay(req.day)) throw APIError.invalidArgument("Pick a date.");
    if (!MANUAL_KINDS.includes(req.kind)) throw APIError.invalidArgument("Pick orange day, purple shift or training course.");
    const dn = needsDayNight(req.kind) ? req.day_night : undefined;
    if (needsDayNight(req.kind) && dn !== "Day" && dn !== "Night") throw APIError.invalidArgument("Say whether it's a day or a night shift.");
    const who = await person(userId);

    // Changing a confirmed orange day starts it again as "might be called in".
    const before = await db.rawQueryRow<{ id: number; shift_adjustment_id: number | null }>(
      `SELECT id, shift_adjustment_id FROM roster_days WHERE user_id = $1 AND day = $2::date`, userId, req.day,
    );
    if (before) await dropBooking(before);

    const saved = await db.rawQueryRow<{ id: number }>(
      `INSERT INTO roster_days (user_id, day, kind, day_night, source, created_by)
       VALUES ($1, $2::date, $3, $4, 'manual', $5)
       ON CONFLICT (user_id, day) DO UPDATE
         SET kind = EXCLUDED.kind, day_night = EXCLUDED.day_night, code = NULL, source = 'manual',
             shift_adjustment_id = NULL, updated_at = NOW()
       RETURNING id`,
      userId, req.day, req.kind, dn ?? null, auth.userID,
    );
    if (!saved) throw APIError.internal("Couldn't save that day.");

    await logActivity({
      user_id: auth.userID, action: "save_roster_day", entity_type: "roster_day", entity_id: String(saved.id),
      details: { for: userId, day: req.day, kind: req.kind, day_night: dn ?? null },
    });
    await tell(auth, who, `has put ${rosterDayText(req.kind, dn ?? null)} on ${niceDay(req.day)}.`, req.day);
    return (await loadDay(Number(saved.id)))!;
  },
);

interface DeleteRosterDayRequest { id: number }

export const deleteRosterDay = api<DeleteRosterDayRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/roster-days/:id" },
  async (req) => {
    const auth = getAuthData()!;
    const row = await loadDay(req.id);
    if (!row) throw APIError.notFound("That day has already gone.");
    if (row.user_id !== auth.userID && !isManager(auth)) throw APIError.permissionDenied("You can only change your own calendar.");
    await dropBooking(row);
    await db.rawExec(`DELETE FROM roster_days WHERE id = $1`, req.id);
    await logActivity({
      user_id: auth.userID, action: "delete_roster_day", entity_type: "roster_day", entity_id: String(req.id),
      details: { for: row.user_id, day: row.day, kind: row.kind },
    });
    await tell(auth, { id: row.user_id, name: row.user_name, watch: row.watch },
      `has taken ${rosterDayText(row.kind, row.day_night)} off ${niceDay(row.day)}.`, row.day);
  },
);

// ── Confirm an orange day ────────────────────────────────────────────────────

interface ConfirmRosterDayRequest {
  id: number;
  /** true = "I'm in"; false = back to "might be called in". */
  confirmed: boolean;
}

export const confirmRosterDay = api<ConfirmRosterDayRequest, RosterDay>(
  { auth: true, expose: true, method: "POST", path: "/roster-days/:id/confirm" },
  async (req) => {
    const auth = getAuthData()!;
    const row = await loadDay(req.id);
    if (!row) throw APIError.notFound("That day has gone.");
    if (row.user_id !== auth.userID && !isManager(auth)) throw APIError.permissionDenied("Only the person or a WC/CC can confirm this.");
    if (row.kind !== "orange") throw APIError.failedPrecondition("Only an orange day is confirmed.");
    const who = { id: row.user_id, name: row.user_name, watch: row.watch };

    if (!req.confirmed) {
      if (!row.confirmed) return row;
      await dropBooking(row);
      await db.rawExec(`UPDATE roster_days SET shift_adjustment_id = NULL, updated_at = NOW() WHERE id = $1`, req.id);
      await tell(auth, who, `has un-confirmed the orange day on ${niceDay(row.day)}${row.day_night ? ` · ${row.day_night}` : ""} — back to "might be called in".`, row.day);
      return (await loadDay(req.id))!;
    }

    if (row.confirmed) return row;
    if (!row.watch) throw APIError.failedPrecondition(`${row.user_name} needs a watch set before an orange day can be confirmed.`);
    const dn: DayNight = row.day_night ?? "Day";
    // The watch on duty for that shift is the one they'd be riding with.
    const onDuty = watchForSlot(shiftSlot(row.day, dn === "Night" ? "night" : "day"))?.watch ?? null;
    const dayDate = new Date(`${row.day}T00:00:00Z`);
    const adj = await db.queryRow<{ id: number }>`
      INSERT INTO shift_adjustments (
        user_id, type, start_date, end_date, covering_watch, shift_day_night, watch_unit, notes, created_by_user_id
      ) VALUES (
        ${row.user_id}, 'orange_day', ${dayDate}, ${dayDate}, ${onDuty}, ${dn}, ${row.watch},
        'Orange day confirmed', ${auth.userID}
      )
      RETURNING id
    `;
    if (!adj) throw APIError.internal("Couldn't confirm the orange day.");
    try {
      await insertAdjustmentEvents(
        {
          id: Number(adj.id), user_id: row.user_id, type: "orange_day", start_date: row.day, end_date: row.day,
          covering_watch: onDuty, shift_day_night: dn, created_by_user_id: auth.userID,
        },
        { name: row.user_name, watch_unit: row.watch },
      );
    } catch (err) {
      console.error("orange day calendar entries failed:", err);
    }
    await db.rawExec(`UPDATE roster_days SET shift_adjustment_id = $2, updated_at = NOW() WHERE id = $1`, req.id, adj.id);
    await logActivity({
      user_id: auth.userID, action: "confirm_orange_day", entity_type: "roster_day", entity_id: String(req.id),
      details: { for: row.user_id, day: row.day, day_night: dn, with_watch: onDuty },
    });
    await tell(auth, who, `has confirmed the orange day on ${niceDay(row.day)} · ${dn}${onDuty ? ` (with ${onDuty} Watch)` : ""}.`, row.day);
    return (await loadDay(req.id))!;
  },
);

// ── Load a year's schedule (admin) ───────────────────────────────────────────

interface ImportRosterDaysRequest {
  rows: ImportRow[];
  /** true = only say what would happen. */
  dry_run?: boolean;
}

export interface ImportRosterDaysResponse {
  /** People in the file the hub knows. */
  people: number;
  /** Days the file gives them. */
  days: number;
  /** Of those, new ones added (0 on a dry run). */
  added: number;
  /** Days left alone because the person or a WC/CC has already confirmed or changed them. */
  kept: number;
  by_kind: Record<string, number>;
  unmatched: string[];
  skipped: Record<string, number>;
  bad: number;
  dry_run: boolean;
}

export const importRosterDays = api<ImportRosterDaysRequest, ImportRosterDaysResponse>(
  { auth: true, expose: true, method: "POST", path: "/roster-days/import" },
  async (req) => {
    const auth = getAuthData()!;
    if (!auth.isAdmin) throw APIError.permissionDenied("Only an admin can load a schedule.");
    if (!Array.isArray(req.rows) || req.rows.length === 0) throw APIError.invalidArgument("The file has no days in it.");
    if (req.rows.length > 20000) throw APIError.invalidArgument("That file is too big — one year for one station at a time.");

    const users = await db.rawQueryAll<{ user_id: string; service_number: string }>(
      `SELECT fp.user_id, TRIM(fp.service_number) AS service_number
       FROM firefighter_profiles fp JOIN users u ON u.id = fp.user_id
       WHERE u.left_at IS NULL AND fp.service_number IS NOT NULL AND TRIM(fp.service_number) <> ''`,
    );
    const sorted = sortImport(req.rows, new Map(users.map((u) => [u.service_number, u.user_id])));
    const by_kind: Record<string, number> = {};
    for (const d of sorted.days) by_kind[d.kind] = (by_kind[d.kind] ?? 0) + 1;
    const people = [...new Set(sorted.days.map((d) => d.user_id))];
    const out: ImportRosterDaysResponse = {
      people: people.length, days: sorted.days.length, added: 0, kept: 0, by_kind,
      unmatched: sorted.unmatched, skipped: sorted.skipped, bad: sorted.bad, dry_run: !!req.dry_run,
    };
    if (req.dry_run || sorted.days.length === 0) return out;

    // Loading the same year again replaces what the last load put there, but
    // never a day someone has confirmed or changed by hand since.
    const years = [...new Set(sorted.days.map((d) => d.day.slice(0, 4)))];
    for (const y of years) {
      await db.rawExec(
        `DELETE FROM roster_days
         WHERE source = 'import' AND shift_adjustment_id IS NULL
           AND user_id = ANY($1::text[]) AND day BETWEEN $2::date AND $3::date`,
        people, `${y}-01-01`, `${y}-12-31`,
      );
    }
    const added = await db.rawQueryAll<{ id: number }>(
      `INSERT INTO roster_days (user_id, day, kind, day_night, code, source, created_by)
       SELECT t.user_id, t.day::date, t.kind, NULLIF(t.dn, ''), t.code, 'import', $6
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[]) AS t(user_id, day, kind, dn, code)
       ON CONFLICT (user_id, day) DO NOTHING
       RETURNING id`,
      sorted.days.map((d) => d.user_id),
      sorted.days.map((d) => d.day),
      sorted.days.map((d) => d.kind),
      sorted.days.map((d) => d.day_night ?? ""),
      sorted.days.map((d) => d.code),
      auth.userID,
    );
    out.added = added.length;
    out.kept = sorted.days.length - added.length;
    await logActivity({
      user_id: auth.userID, action: "import_roster_days", entity_type: "roster_day", entity_id: years.join(","),
      details: { people: out.people, days: out.days, added: out.added, kept: out.kept, unmatched: out.unmatched.length },
    });
    return out;
  },
);
