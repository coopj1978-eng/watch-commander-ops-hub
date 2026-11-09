import { api, APIError, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { createNotification, notifyWatchManagers } from "../notification/helpers";
import { addDaysIso, shiftSlot, ukParts, watchForSlot } from "../lib/shiftRota";
import {
  canDecide, canRecordOutcome, canViewRequest, dayLabel, flagLines, flexiChecks, h4hChecks, kronosDeadline, recommendedH4H, rotaFor,
  type Commitment, type DayNight, type FlexiLimits, type Quals, type RequestCheck, type RequestType, type RequestViewer,
} from "../lib/shiftRequests";
import { RIDE_BOTH, RIDE_ONE, ridersOf, shiftStrength } from "../lib/strength";
import { describeShort, seatCheck } from "../lib/ridingSeats";
import { loadStrengthData } from "../lib/strengthData";
import { bookAdjustment } from "./book";

// Flexi Day and Head for Head (Nov 2026). Since 9 Nov 2026 (John: "less
// resistance" for firefighters) they go straight on: putting one through
// books it on the calendar, crewing board and riding count at once, and the
// watch's WC and CC get an alert with any flags (over 4 a year, short notice,
// a clash) as the paper trail. Only "no shift that day" stops one. Each stays
// as a record (timeline in shift_request_events); nothing here deletes one.
// The older sign-off steps (cover confirms, WC decides, Kronos result) are
// kept for any request made before then.

export type RequestStatus =
  | "with_cover" | "cover_declined" | "with_wc" | "authorised" | "referred"
  | "declined" | "approved" | "not_approved" | "withdrawn" | "cancelled";

export interface ShiftRequest {
  id: number;
  type: RequestType;
  status: RequestStatus;
  user_id: string | null;
  user_name: string;
  user_role: string;
  payroll_number: string | null;
  station: string | null;
  watch: string;
  shift_date: string;
  shift_type: string;
  day_night: DayNight;
  notes: string | null;
  reviewer_user_id: string | null;
  reviewer_name: string | null;
  cover_user_id: string | null;
  cover_name: string | null;
  cover_payroll: string | null;
  cover_station: string | null;
  cover_watch: string | null;
  cover_confirmed_at: string | null;
  cover_confirmed_by_name: string | null;
  payback_date: string | null;
  payback_day_night: DayNight | null;
  payback_watch: string | null;
  payback_status: "with_wc" | "authorised" | null;
  payback_signed_by_name: string | null;
  payback_signed_at: string | null;
  decided_by_name: string | null;
  decided_by_role: string | null;
  decided_at: string | null;
  wc_comments: string | null;
  pinch_point: "green" | "white" | "red" | null;
  over_limit_agreed: boolean;
  sc_endorsed: boolean;
  checks: RequestCheck[] | null;
  outcome_at: string | null;
  outcome_by_name: string | null;
  outcome_note: string | null;
  shift_adjustment_id: number | null;
  payback_adjustment_id: number | null;
  created_by_name: string;
  created_at: string;
}

export interface RequestEvent {
  at: string;
  by_name: string;
  action: string;
  detail: string | null;
}

export interface RequestDetail {
  request: ShiftRequest;
  events: RequestEvent[];
  /** Live while it's waiting on a decision, then what the WC saw when they signed. */
  checks: RequestCheck[];
  recommended: "authorised" | "referred" | "declined" | null;
  /** When it must be on Kronos by (Flexi). */
  kronos_by: string | null;
  can: {
    decide: boolean;
    confirm_cover: boolean;
    record_outcome: boolean;
    withdraw: boolean;
    add_payback: boolean;
    decide_payback: boolean;
  };
}

const COLUMNS = `
  id::int AS id, type, status, user_id, user_name, user_role, payroll_number, station, watch,
  shift_date::text AS shift_date, shift_type, day_night, notes, reviewer_user_id, reviewer_name,
  cover_user_id, cover_name, cover_payroll, cover_station, cover_watch, cover_confirmed_at, cover_confirmed_by_name,
  payback_date::text AS payback_date, payback_day_night, payback_watch, payback_status, payback_signed_by_name, payback_signed_at,
  decided_by_name, decided_by_role, decided_at, wc_comments, pinch_point, over_limit_agreed, sc_endorsed, checks,
  outcome_at, outcome_by_name, outcome_note, shift_adjustment_id::int AS shift_adjustment_id,
  payback_adjustment_id::int AS payback_adjustment_id, created_by_name, created_at`;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const OPEN = ["with_cover", "with_wc", "authorised", "referred"];
const TYPE_LABEL: Record<RequestType, string> = { flexi: "Flexi Day", h4h: "Head for Head" };

// ─── Loading ──────────────────────────────────────────────────────────────────
interface Person extends Quals {
  id: string;
  name: string;
  role: string;
  watch: string | null;
  service_number: string | null;
  station: string | null;
}

async function loadPerson(id: string): Promise<Person | null> {
  return db.rawQueryRow<Person>(
    `SELECT u.id, u.name, u.role, COALESCE(u.watch_unit, p.watch) AS watch, p.service_number, p.station,
            COALESCE(p.oic, false) AS oic, COALESCE(p.ba, false) AS ba, COALESCE(p.prps, false) AS prps,
            COALESCE(p.driver_lgv, false) AS driver_lgv, COALESCE(p.driver_erd, false) AS driver_erd,
            COALESCE(p.mass_decon, false) AS mass_decon, COALESCE(p.hooklift_operator, false) AS hooklift_operator
     FROM users u
     LEFT JOIN firefighter_profiles p ON p.user_id = u.id
     WHERE u.id = $1 AND u.left_at IS NULL`,
    id
  );
}

async function loadViewer(): Promise<Person> {
  const me = await loadPerson(getAuthData()!.userID);
  if (!me) throw APIError.permissionDenied("Your account isn't active.");
  return me;
}

const asViewer = (p: Person): RequestViewer => ({ id: p.id, role: p.role, watch: p.watch });
const isManager = (p: Person) => p.role === "WC" || p.role === "CC";

async function loadRequest(id: number): Promise<ShiftRequest> {
  const r = await db.rawQueryRow<ShiftRequest>(`SELECT ${COLUMNS} FROM shift_requests WHERE id = $1`, id);
  if (!r) throw APIError.notFound("Request not found.");
  return r;
}

async function loadLimits(): Promise<FlexiLimits> {
  const row = await db.rawQueryRow<FlexiLimits>(
    `SELECT flexi_limit_per_year AS per_year, flexi_days_ahead AS days_ahead, flexi_notice_hours AS notice_hours
     FROM system_settings ORDER BY id DESC LIMIT 1`
  );
  if (!row) throw APIError.internal("System settings not found.");
  return row;
}

/** Flexi days this person has used or asked for this calendar year. */
async function flexiUsed(userId: string, year: number, excludeId = 0): Promise<{ opening: number; in_app: number }> {
  const opening = await db.rawQueryRow<{ used: number }>(
    `SELECT used FROM flexi_opening_balances WHERE user_id = $1 AND year = $2`,
    userId, year
  );
  const inApp = await db.rawQueryRow<{ n: number }>(
    `SELECT count(*)::int AS n FROM shift_requests
     WHERE type = 'flexi' AND user_id = $1 AND EXTRACT(YEAR FROM shift_date)::int = $2
       AND status IN ('with_wc', 'authorised', 'approved') AND id <> $3`,
    userId, year, excludeId
  );
  return { opening: opening?.used ?? 0, in_app: inApp?.n ?? 0 };
}

/** What someone is already down to work around a date, and the days they're booked off. */
async function commitmentsFor(userId: string, date: string, excludeId = 0) {
  const from = addDaysIso(date, -1);
  const to = addDaysIso(date, 1);
  const commitments: Commitment[] = [];
  const offDates = new Set<string>();

  const rows = await db.rawQueryAll<{
    type: string; user_id: string; start: string; end: string; day_night: DayNight | null;
  }>(
    `SELECT type, user_id, start_date::date::text AS start, end_date::date::text AS "end", shift_day_night AS day_night
     FROM shift_adjustments
     WHERE start_date::date <= $3::date AND end_date::date >= $2::date
       AND (user_id = $1 OR covering_user_id = $1)`,
    userId, from, to
  );
  const WHAT: Record<string, string> = {
    orange_day: "an Orange Day", flexi_payback: "a Flexi Payback", training: "training",
  };
  for (const a of rows) {
    // A night belongs to the day it starts, whatever an older booking's end date says.
    const last = a.day_night === "Night" ? a.start : a.end;
    for (const d of [from, date, to]) {
      if (d < a.start || d > last) continue;
      if (a.user_id !== userId) {
        commitments.push({ date: d, dayNight: a.day_night, what: a.type === "toil" ? "TOIL cover" : "a Head for Head", firm: true });
      } else if (WHAT[a.type]) {
        commitments.push({ date: d, dayNight: a.day_night, what: WHAT[a.type], firm: true });
      } else {
        offDates.add(d);
      }
    }
  }

  const pending = await db.rawQueryAll<{
    user_id: string; shift_date: string; day_night: DayNight; payback_date: string | null; payback_day_night: DayNight | null;
  }>(
    `SELECT user_id, shift_date::text AS shift_date, day_night, payback_date::text AS payback_date, payback_day_night
     FROM shift_requests
     WHERE status = ANY($4::text[]) AND id <> $5
       AND ((cover_user_id = $1 AND shift_date BETWEEN $2::date AND $3::date)
         OR (user_id = $1 AND payback_date BETWEEN $2::date AND $3::date))`,
    userId, from, to, OPEN, excludeId
  );
  for (const p of pending) {
    const asPayback = p.user_id === userId;
    commitments.push({
      date: asPayback ? p.payback_date! : p.shift_date,
      dayNight: asPayback ? p.payback_day_night : p.day_night,
      what: "another Head for Head request",
      firm: false,
    });
  }
  return { commitments, offDates };
}

async function eventsDuring(watch: string, date: string, dayNight: DayNight): Promise<string[]> {
  const slot = shiftSlot(date, dayNight === "Night" ? "night" : "day");
  const rows = await db.rawQueryAll<{ title: string }>(
    `SELECT title FROM calendar_events
     WHERE cancelled_at IS NULL AND shift_adjustment_id IS NULL
       AND (calendar_visibility = 'station' OR (calendar_visibility = 'watch' AND LOWER(watch) = LOWER($1)))
       AND ((all_day AND start_time::date <= $2::date AND end_time::date >= $2::date)
         OR (NOT all_day AND start_time < $4 AND end_time > $3))
     ORDER BY start_time LIMIT 4`,
    watch, date, slot.start, slot.end
  );
  return rows.map((r) => r.title);
}

/** Riding numbers and skills on the watch if this person came off that shift. */
async function crewWithout(userId: string, watch: string, date: string, dayNight: DayNight, label: string) {
  const data = await loadStrengthData(watch, date, date);
  const s = shiftStrength({
    watch, date, dayNight,
    roster: data.roster, absences: data.absences, adjustments: data.adjustments,
    detachedIds: new Set(data.detached.filter((d) => d.date === date && d.shift_type === label).map((d) => d.user_id)),
  });
  const away = new Set(s.away.map((a) => a.id));
  const counted = data.roster.some((m) => m.id === userId) && !away.has(userId);
  const { quals } = ridersOf(s, data.roster, data.quals, userId);
  const seats = seatCheck(quals);
  return {
    crew: { available: s.available - (counted ? 1 : 0), total: s.total, rideOne: RIDE_ONE, rideBoth: RIDE_BOTH },
    skillsLeft: {
      oic: quals.filter((q) => q.oic).length,
      drivers: quals.filter((q) => q.driver).length,
      ba: quals.filter((q) => q.ba).length,
      pumps: seats.pumps,
      short: describeShort(seats.short),
    },
  };
}

// ─── Checks ───────────────────────────────────────────────────────────────────
interface Draft {
  type: RequestType;
  user: Person;
  date: string;
  dayNight: DayNight;
  shiftType: string;
  cover: Person | null;
  coverName: string;
  payback: { date: string; dayNight: DayNight } | null;
  excludeId: number;
}

async function runChecks(d: Draft): Promise<RequestCheck[]> {
  const watch = d.user.watch!;
  if (d.type === "flexi") {
    const used = await flexiUsed(d.user.id, Number(d.date.slice(0, 4)), d.excludeId);
    const onRota = rotaFor(watch, d.date).working;
    const [limits, events, crewInfo] = await Promise.all([
      loadLimits(),
      eventsDuring(watch, d.date, d.dayNight),
      onRota ? crewWithout(d.user.id, watch, d.date, d.dayNight, d.shiftType) : Promise.resolve(null),
    ]);
    return flexiChecks({
      watch, date: d.date, dayNight: d.dayNight, now: new Date(), limits,
      used: used.opening + used.in_app, events,
      crew: crewInfo?.crew, skillsLeft: crewInfo?.skillsLeft,
    });
  }

  const coverSide = d.cover ? await commitmentsFor(d.cover.id, d.date, d.excludeId) : null;
  const paybackSide = d.payback ? await commitmentsFor(d.user.id, d.payback.date, d.excludeId) : null;
  return h4hChecks({
    watch, date: d.date, dayNight: d.dayNight,
    applicantName: d.user.name, applicantQuals: d.user,
    cover: d.cover && coverSide
      ? { name: d.cover.name, watch: d.cover.watch, quals: d.cover, commitments: coverSide.commitments, offDates: coverSide.offDates }
      : null,
    coverName: d.coverName,
    payback: d.payback && paybackSide
      ? { date: d.payback.date, dayNight: d.payback.dayNight, applicantCommitments: paybackSide.commitments, applicantOffDates: paybackSide.offDates }
      : null,
  });
}

const forViewer = (checks: RequestCheck[], viewer: Person) =>
  isManager(viewer) ? checks : checks.filter((c) => !c.managersOnly);

async function checksForRequest(r: ShiftRequest): Promise<RequestCheck[] | null> {
  const user = r.user_id ? await loadPerson(r.user_id) : null;
  if (!user?.watch) return null;
  const cover = r.cover_user_id ? await loadPerson(r.cover_user_id) : null;
  return runChecks({
    type: r.type, user, date: r.shift_date, dayNight: r.day_night, shiftType: r.shift_type,
    cover, coverName: r.cover_name ?? "",
    payback: r.type === "h4h" && r.payback_date ? { date: r.payback_date, dayNight: r.payback_day_night ?? "Day" } : null,
    excludeId: r.id,
  });
}

// ─── Record keeping ───────────────────────────────────────────────────────────
async function addEvent(requestId: number, by: { id: string; name: string }, action: string, detail?: string | null) {
  await db.rawExec(
    `INSERT INTO shift_request_events (request_id, by_user_id, by_name, action, detail) VALUES ($1, $2, $3, $4, $5)`,
    requestId, by.id, by.name, action, detail || null
  );
}

function linkNote(r: ShiftRequest, title: string, message: string) {
  return { type: "general" as const, title, message, entity_type: "shift_request", entity_id: String(r.id), link: `/requests?open=${r.id}` };
}

async function tell(userId: string | null, actor: string, note: ReturnType<typeof linkNote>) {
  if (!userId || userId === actor) return;
  try {
    await createNotification({ ...note, user_id: userId });
  } catch (err) {
    console.error("Failed to send request notification:", err);
  }
}

/** Whoever can sign it: the chosen WC, a CC's WC, or the watch's WC and CC. */
async function tellSigners(r: ShiftRequest, actor: string, note: ReturnType<typeof linkNote>) {
  if (r.reviewer_user_id) return tell(r.reviewer_user_id, actor, note);
  const exclude = [r.user_id, r.cover_user_id, actor].filter((x): x is string => !!x);
  if (r.user_role === "CC") {
    const wcs = await db.rawQueryAll<{ id: string }>(
      `SELECT u.id FROM users u LEFT JOIN firefighter_profiles p ON p.user_id = u.id
       WHERE u.role = 'WC' AND u.left_at IS NULL AND LOWER(COALESCE(u.watch_unit, p.watch)) = LOWER($1)
         AND NOT (u.id = ANY($2::text[]))`,
      r.watch, exclude
    );
    if (wcs.length) {
      for (const wc of wcs) await tell(wc.id, actor, note);
      return;
    }
  }
  await notifyWatchManagers(r.watch, exclude, note);
}

const describe = (r: ShiftRequest) => `${TYPE_LABEL[r.type]} on ${dayLabel(r.shift_date)} (${r.shift_type})`;

async function detailFor(id: number, viewer: Person): Promise<RequestDetail> {
  const r = await loadRequest(id);
  if (!canViewRequest(asViewer(viewer), r)) {
    throw APIError.permissionDenied("Only the people involved and their WC/CC can see this request.");
  }
  const events = await db.rawQueryAll<RequestEvent>(
    `SELECT at, by_name, action, detail FROM shift_request_events WHERE request_id = $1 ORDER BY at, id`,
    id
  );

  const stored = (typeof r.checks === "string" ? JSON.parse(r.checks) : r.checks) as RequestCheck[] | null;
  const undecided = r.status === "with_cover" || r.status === "with_wc";
  const paybackWaiting = r.payback_status === "with_wc";
  const live = undecided || paybackWaiting ? await checksForRequest(r) : null;
  const checks = live ?? stored ?? [];

  const limits = r.type === "flexi" ? await loadLimits() : null;
  const me = asViewer(viewer);
  const signer = canDecide(me, r);
  return {
    request: { ...r, checks: stored ? forViewer(stored, viewer) : null },
    events,
    checks: forViewer(checks, viewer),
    recommended: r.type === "h4h" && undecided ? recommendedH4H(checks) : null,
    kronos_by: limits && (undecided || r.status === "authorised")
      ? kronosDeadline(r.shift_date, r.day_night, limits.notice_hours).toISOString()
      : null,
    can: {
      decide: signer && r.status === "with_wc",
      confirm_cover: r.status === "with_cover" && (viewer.id === r.cover_user_id || signer),
      record_outcome: (r.status === "authorised" || r.status === "referred") && canRecordOutcome(me, r),
      withdraw: OPEN.includes(r.status) && (viewer.id === r.user_id || signer),
      add_payback: r.type === "h4h" && !r.payback_date && (OPEN.includes(r.status) || r.status === "approved")
        && (viewer.id === r.user_id || viewer.id === r.cover_user_id || signer),
      decide_payback: signer && paybackWaiting,
    },
  };
}

/** A cancelled booking stays on the record as cancelled. Called before it's deleted. */
export async function noteBookingRemoved(adjustmentId: number, byUserId: string): Promise<void> {
  try {
    const rows = await db.rawQueryAll<{ id: number; main: boolean }>(
      `SELECT id::int AS id, shift_adjustment_id = $1 AS main FROM shift_requests
       WHERE shift_adjustment_id = $1 OR payback_adjustment_id = $1`,
      adjustmentId
    );
    if (!rows.length) return;
    const by = await db.queryRow<{ name: string }>`SELECT name FROM users WHERE id = ${byUserId}`;
    for (const r of rows) {
      if (r.main) {
        await db.rawExec(`UPDATE shift_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, r.id);
        await addEvent(r.id, { id: byUserId, name: by?.name ?? "Unknown" }, "Booking cancelled");
      } else {
        await db.rawExec(
          `UPDATE shift_requests SET payback_date = NULL, payback_day_night = NULL, payback_status = NULL, updated_at = NOW() WHERE id = $1`,
          r.id
        );
        await addEvent(r.id, { id: byUserId, name: by?.name ?? "Unknown" }, "Payback booking cancelled");
      }
    }
  } catch (err) {
    console.error("Failed to note a cancelled booking on its request:", err);
  }
}

// ─── Asking ───────────────────────────────────────────────────────────────────
interface DraftBody {
  type: RequestType;
  shift_date: string;
  /** Only needed for an annual leave date, which has no shift on the rota. */
  day_night?: DayNight;
  /** WC/CC raising it for someone. */
  for_user_id?: string;
  cover_user_id?: string;
  cover_name?: string;
  payback_date?: string;
  payback_day_night?: DayNight;
}

async function buildDraft(body: DraftBody, viewer: Person): Promise<Draft> {
  if (body.type !== "flexi" && body.type !== "h4h") throw APIError.invalidArgument("Unknown request type.");
  if (!ISO.test(body.shift_date)) throw APIError.invalidArgument("Pick a date.");
  const targetId = body.for_user_id || viewer.id;
  if (targetId !== viewer.id && !isManager(viewer)) {
    throw APIError.permissionDenied("Only a WC or CC can raise a request for someone else.");
  }
  const user = targetId === viewer.id ? viewer : await loadPerson(targetId);
  if (!user) throw APIError.notFound("That person isn't on the system.");
  if (!user.watch) throw APIError.failedPrecondition("That person needs a watch set first.");

  const rota = rotaFor(user.watch, body.shift_date);
  const dayNight: DayNight = rota.dayNight ?? body.day_night ?? "Day";

  let cover: Person | null = null;
  let coverName = "";
  let payback: Draft["payback"] = null;
  if (body.type === "h4h") {
    if (body.cover_user_id) {
      if (body.cover_user_id === user.id) throw APIError.invalidArgument("Someone can't cover their own shift.");
      cover = await loadPerson(body.cover_user_id);
      if (!cover) throw APIError.notFound("That person isn't on the system.");
      coverName = cover.name;
    } else {
      coverName = body.cover_name?.trim() ?? "";
    }
    if (body.payback_date) {
      if (!ISO.test(body.payback_date)) throw APIError.invalidArgument("Pick a payback date.");
      payback = { date: body.payback_date, dayNight: body.payback_day_night ?? "Day" };
    }
  }
  return { type: body.type, user, date: body.shift_date, dayNight, shiftType: rota.label ?? "", cover, coverName, payback, excludeId: 0 };
}

interface PreviewResponse {
  shift_type: string;
  day_night: DayNight;
  /** An annual leave date: the rota can't say which shift. */
  needs_day_night: boolean;
  checks: RequestCheck[];
  recommended: "authorised" | "referred" | "declined" | null;
  kronos_by: string | null;
}

/** The applicant's own checks, run live as they fill it in. */
export const previewRequest = api<DraftBody, PreviewResponse>(
  { auth: true, expose: true, method: "POST", path: "/shift-requests/preview" },
  async (body) => {
    const viewer = await loadViewer();
    const d = await buildDraft(body, viewer);
    const checks = await runChecks(d);
    const limits = d.type === "flexi" ? await loadLimits() : null;
    return {
      shift_type: d.shiftType,
      day_night: d.dayNight,
      needs_day_night: rotaFor(d.user.watch!, d.date).leave,
      checks: forViewer(checks, viewer),
      recommended: d.type === "h4h" ? recommendedH4H(checks) : null,
      kronos_by: limits ? kronosDeadline(d.date, d.dayNight, limits.notice_hours).toISOString() : null,
    };
  }
);

interface CreateBody extends DraftBody {
  notes?: string;
  reviewer_user_id?: string;
  cover_payroll?: string;
  cover_station?: string;
  cover_watch?: string;
}

export const createRequest = api<CreateBody, RequestDetail>(
  { auth: true, expose: true, method: "POST", path: "/shift-requests" },
  async (body) => {
    const viewer = await loadViewer();
    const d = await buildDraft(body, viewer);
    if (d.type === "h4h" && !d.coverName) throw APIError.invalidArgument("Say who's covering the shift.");

    // Only "there's no shift that day" stops it. Everything else (over 4 a
    // year, short notice, a clash, crew numbers) is kept as a flag on the
    // record and in the WC's alert (John, 9 Nov 2026).
    const checks = await runChecks(d);
    const blocked = checks.find((c) => c.blocks);
    if (blocked) throw APIError.failedPrecondition(`${blocked.label}: ${blocked.detail}.`);
    if (!d.user.id) throw APIError.failedPrecondition("That person isn't on the system.");

    const clash = await db.rawQueryRow<{ id: number }>(
      `SELECT id::int AS id FROM shift_requests
       WHERE user_id = $1 AND type = $2 AND shift_date = $3::date AND status = ANY($4::text[]) LIMIT 1`,
      d.user.id, d.type, d.date, [...OPEN, "approved"]
    );
    if (clash) throw APIError.alreadyExists(`There's already a ${TYPE_LABEL[d.type]} for that date (#${clash.id}).`);

    // Straight on: the record is made already booked ("approved"), with the
    // checks as they stood kept on it. No sign-off and no Kronos step.
    const shiftType = d.shiftType === "Annual Leave" ? `Annual Leave (${d.dayNight})` : d.shiftType;
    const paybackWatch = d.payback && d.cover?.watch ? d.cover.watch : null;
    const row = await db.rawQueryRow<{ id: number }>(
      `INSERT INTO shift_requests (
         type, status, user_id, user_name, user_role, payroll_number, station, watch,
         shift_date, shift_type, day_night, notes,
         cover_user_id, cover_name, cover_payroll, cover_station, cover_watch,
         payback_date, payback_day_night, payback_watch, payback_status, created_by, created_by_name, checks
       ) VALUES (
         $1, 'approved', $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11,
         $12, $13, $14, $15, $16, $17::date, $18, $19, $20, $21, $22, $23::text::jsonb
       ) RETURNING id::int AS id`,
      d.type, d.user.id, d.user.name, d.user.role, d.user.service_number, d.user.station, d.user.watch,
      d.date, shiftType, d.dayNight, body.notes?.trim() || null,
      d.cover?.id ?? null, d.coverName || null,
      d.cover?.service_number ?? (body.cover_payroll?.trim() || null),
      d.cover?.station ?? (body.cover_station?.trim() || null),
      d.cover?.watch ?? (body.cover_watch?.trim() || null),
      d.payback?.date ?? null, d.payback?.dayNight ?? null, paybackWatch, d.payback ? "authorised" : null,
      viewer.id, viewer.name, JSON.stringify(checks)
    );
    if (!row) throw APIError.internal("Couldn't save it.");

    const adjustmentId = await bookAdjustment({
      type: d.type, userId: d.user.id, date: d.date, dayNight: d.dayNight,
      coveringUserId: d.cover?.id ?? null, coveringName: d.coverName || null,
      notes: `Request #${row.id}`, createdBy: viewer.id,
    });
    // An H4H payback agreed up front: the person covering gets their shift back then.
    const paybackId = d.payback && d.cover
      ? await bookAdjustment({
          type: "h4h", userId: d.cover.id, date: d.payback.date, dayNight: d.payback.dayNight,
          coveringUserId: d.user.id, coveringName: d.user.name, notes: `Request #${row.id} payback`, createdBy: viewer.id,
        })
      : null;
    await db.rawExec(
      `UPDATE shift_requests SET shift_adjustment_id = $2, payback_adjustment_id = $3, updated_at = NOW() WHERE id = $1`,
      row.id, adjustmentId, paybackId
    );

    const r = await loadRequest(row.id);
    const flags = flagLines(checks);
    const payback = r.payback_date ? ` Payback: ${dayLabel(r.payback_date)} (${r.payback_day_night}).` : "";
    await addEvent(r.id, viewer,
      viewer.id === d.user.id ? "Booked on the calendar" : `Booked for ${d.user.name}`,
      [body.notes?.trim(), flags.length ? `Flagged: ${flags.join("; ")}` : null, payback.trim() || null].filter(Boolean).join(" ") || null);

    // The paper trail: the watch's WC and CC hear about it, with any flags.
    const who = viewer.id === d.user.id ? r.user_name : `${viewer.name} for ${r.user_name}`;
    await notifyWatchManagers(r.watch, [d.user.id, viewer.id], linkNote(r,
      `${TYPE_LABEL[r.type]} booked${flags.length ? " · flagged" : ""}: ${r.user_name}`,
      `${who} (${r.watch} Watch) put ${describe(r)} on the calendar${r.cover_name ? `, ${r.cover_name} covering` : ""}.${payback}`
        + (flags.length ? ` Flagged: ${flags.join("; ")}.` : "")));
    // Head for Head: the person covering is told it's on their calendar.
    if (r.cover_user_id) {
      await tell(r.cover_user_id, viewer.id, linkNote(r, "Head for Head: you're covering",
        `${r.user_name} has put you down to cover ${dayLabel(r.shift_date)} (${r.shift_type}, ${r.watch} Watch). It's on your calendar.`
          + (r.payback_date ? ` They pay it back on ${dayLabel(r.payback_date)} (${r.payback_day_night}).` : "")
          + " If you didn't agree to this, tell them or your WC."));
    }
    // Raised by a WC/CC for someone: that person is told too.
    if (viewer.id !== d.user.id) {
      await tell(d.user.id, viewer.id, linkNote(r, `${TYPE_LABEL[r.type]} booked for you`,
        `${viewer.name} put ${describe(r)} on your calendar.`));
    }

    await logActivity({
      user_id: viewer.id, action: "book_shift_request", entity_type: "shift_request", entity_id: String(r.id),
      details: { type: r.type, shift_date: r.shift_date, shift_adjustment_id: adjustmentId, flags: flags.length },
    });
    return detailFor(r.id, viewer);
  }
);

export const getRequest = api<{ id: number }, RequestDetail>(
  { auth: true, expose: true, method: "GET", path: "/shift-requests/record/:id" },
  async ({ id }) => detailFor(id, await loadViewer())
);

// ─── The cover agrees ─────────────────────────────────────────────────────────
export const confirmCover = api<{ id: number; agreed: boolean; note?: string }, RequestDetail>(
  { auth: true, expose: true, method: "POST", path: "/shift-requests/:id/confirm-cover" },
  async ({ id, agreed, note }) => {
    const viewer = await loadViewer();
    const r = await loadRequest(id);
    const self = viewer.id === r.cover_user_id;
    if (!self && !canDecide(asViewer(viewer), r)) {
      throw APIError.permissionDenied("Only the person covering or their WC/CC can answer this.");
    }
    if (r.status !== "with_cover") throw APIError.failedPrecondition("This request isn't waiting on the cover.");

    if (agreed) {
      await db.rawExec(
        `UPDATE shift_requests SET status = 'with_wc', cover_confirmed_at = NOW(), cover_confirmed_by_name = $2, updated_at = NOW() WHERE id = $1`,
        id, viewer.name
      );
      await addEvent(id, viewer, self ? "Cover confirmed" : `Cover confirmed for ${r.cover_name}`, note?.trim());
      await tellSigners(r, viewer.id, linkNote(r, "Head for Head request to review",
        `${r.user_name} (${r.watch} Watch) and ${r.cover_name} have agreed to swap ${dayLabel(r.shift_date)} (${r.shift_type}).`));
    } else {
      await db.rawExec(`UPDATE shift_requests SET status = 'cover_declined', updated_at = NOW() WHERE id = $1`, id);
      await addEvent(id, viewer, "Cover said no", note?.trim());
      await tell(r.user_id, viewer.id, linkNote(r, "Head for Head not agreed",
        `${r.cover_name} hasn't agreed to cover ${dayLabel(r.shift_date)} (${r.shift_type}).`));
    }
    return detailFor(id, viewer);
  }
);

// ─── The WC decides ───────────────────────────────────────────────────────────
interface DecideBody {
  id: number;
  decision: "authorised" | "referred" | "declined";
  comments?: string;
  pinch_point?: "green" | "white" | "red";
  over_limit_agreed?: boolean;
  sc_endorsed?: boolean;
}

const DECISION_LABEL = { authorised: "Authorised", referred: "Referred", declined: "Declined" } as const;

export const decideRequest = api<DecideBody, RequestDetail>(
  { auth: true, expose: true, method: "POST", path: "/shift-requests/:id/decide" },
  async (body) => {
    const viewer = await loadViewer();
    const r = await loadRequest(body.id);
    if (!canDecide(asViewer(viewer), r)) {
      throw APIError.permissionDenied("Only the watch's WC (or CC when the WC is off) can sign this. Nobody signs their own.");
    }
    if (r.status !== "with_wc") throw APIError.failedPrecondition("This request isn't waiting on a decision.");
    if (body.decision !== "authorised" && body.decision !== "referred" && body.decision !== "declined") {
      throw APIError.invalidArgument("Choose an outcome.");
    }
    if (body.decision === "referred" && r.type !== "h4h") throw APIError.invalidArgument("Only a Head for Head can be referred.");

    const comments = body.comments?.trim() || null;
    if (body.decision === "declined" && !comments) throw APIError.invalidArgument("Say why it's declined.");

    const checks = (await checksForRequest(r)) ?? [];
    const failing = (key: string) => checks.find((c) => c.key === key)?.state === "fail";
    if (body.decision !== "declined") {
      if (r.type === "flexi") {
        if (!body.pinch_point) throw APIError.invalidArgument("Record the pinch point from Kronos first.");
        if (body.pinch_point !== "green") throw APIError.failedPrecondition("A flexi day needs a green pinch point.");
        if (failing("balance") && !(body.over_limit_agreed && body.sc_endorsed)) {
          throw APIError.failedPrecondition("Going over the yearly limit needs your agreement and the SC's endorsement.");
        }
      } else if (body.decision === "authorised" && checks.find((c) => c.key === "skills_match")?.state === "warn") {
        throw APIError.failedPrecondition("The skills don't match, so this should be referred.");
      }
      const flagged = checks.filter((c) => c.state === "fail" && c.key !== "balance");
      if (flagged.length && !comments) {
        throw APIError.invalidArgument(`Say why you're going ahead despite: ${flagged.map((c) => c.label).join(", ")}.`);
      }
    }

    await db.rawExec(
      `UPDATE shift_requests SET
         status = $2, decided_by_id = $3, decided_by_name = $4, decided_by_role = $5, decided_at = NOW(),
         wc_comments = $6, pinch_point = $7, over_limit_agreed = $8, sc_endorsed = $9,
         checks = $10::text::jsonb, updated_at = NOW()
       WHERE id = $1`,
      r.id, body.decision, viewer.id, viewer.name, viewer.role, comments, body.pinch_point ?? null,
      !!body.over_limit_agreed, !!body.sc_endorsed, JSON.stringify(checks)
    );

    const pinch = body.pinch_point ? `Pinch point: ${body.pinch_point}. ` : "";
    await addEvent(r.id, viewer, `${DECISION_LABEL[body.decision]} by ${viewer.role}`, `${pinch}${comments ?? ""}`.trim());

    const limits = r.type === "flexi" ? await loadLimits() : null;
    const by = limits
      ? ` by ${kronosDeadline(r.shift_date, r.day_night, limits.notice_hours).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}`
      : "";
    const note = body.decision === "declined"
      ? linkNote(r, `${TYPE_LABEL[r.type]} declined`, `${describe(r)} was declined by ${viewer.name}: ${comments}. Don't submit it on Kronos.`)
      : linkNote(r, `${TYPE_LABEL[r.type]} ${DECISION_LABEL[body.decision].toLowerCase()}: submit on Kronos`,
          `${describe(r)} was ${DECISION_LABEL[body.decision].toLowerCase()} by ${viewer.name}. Submit it on Kronos${by}, then record the result here.`);
    await tell(r.user_id, viewer.id, note);
    await tell(r.cover_user_id, viewer.id, note);

    await logActivity({
      user_id: viewer.id, action: "decide_shift_request", entity_type: "shift_request", entity_id: String(r.id),
      details: { decision: body.decision, type: r.type },
    });
    return detailFor(r.id, viewer);
  }
);

// ─── The result from Kronos ───────────────────────────────────────────────────
interface OutcomeBody {
  id: number;
  approved: boolean;
  note?: string;
  /** Flexi: the payback date Kronos gave. */
  payback_date?: string;
  payback_day_night?: DayNight;
}

export const recordOutcome = api<OutcomeBody, RequestDetail>(
  { auth: true, expose: true, method: "POST", path: "/shift-requests/:id/outcome" },
  async (body) => {
    const viewer = await loadViewer();
    const r = await loadRequest(body.id);
    if (!canRecordOutcome(asViewer(viewer), r)) {
      throw APIError.permissionDenied("Only the person asking or their WC/CC can record this.");
    }
    if (r.status !== "authorised" && r.status !== "referred") {
      throw APIError.failedPrecondition("This request isn't waiting on a Kronos result.");
    }
    const note = body.note?.trim() || null;

    if (!body.approved) {
      await db.rawExec(
        `UPDATE shift_requests SET status = 'not_approved', outcome_at = NOW(), outcome_by_name = $2, outcome_note = $3, updated_at = NOW() WHERE id = $1`,
        r.id, viewer.name, note
      );
      await addEvent(r.id, viewer, "Declined on Kronos", note);
      const told = linkNote(r, `${TYPE_LABEL[r.type]} declined on Kronos`, `${describe(r)} for ${r.user_name} was declined on Kronos.`);
      await tell(r.user_id, viewer.id, told);
      await tell(r.cover_user_id, viewer.id, told);
      await tellSigners(r, viewer.id, told);
      return detailFor(r.id, viewer);
    }

    if (!r.user_id) throw APIError.failedPrecondition("That person is no longer on the system.");
    let paybackDate = r.payback_date;
    let paybackDn = r.payback_day_night;
    let paybackWatch: string | null = r.payback_watch;
    if (r.type === "flexi") {
      if (!body.payback_date || !ISO.test(body.payback_date)) throw APIError.invalidArgument("Enter the payback date Kronos gave.");
      paybackDate = body.payback_date;
      paybackDn = body.payback_day_night ?? "Day";
      // Whichever watch is on that shift is the one they'll work with.
      paybackWatch = watchForSlot(shiftSlot(paybackDate, paybackDn === "Night" ? "night" : "day"))?.watch ?? r.watch;
    }

    const adjustmentId = await bookAdjustment({
      type: r.type, userId: r.user_id, date: r.shift_date, dayNight: r.day_night,
      coveringUserId: r.cover_user_id, coveringName: r.cover_name,
      notes: `Request #${r.id}`, createdBy: viewer.id,
    });
    let paybackId: number | null = null;
    if (paybackDate && paybackDn) {
      if (r.type === "flexi") {
        paybackId = await bookAdjustment({
          type: "flexi_payback", userId: r.user_id, date: paybackDate, dayNight: paybackDn,
          coveringWatch: paybackWatch, notes: `Request #${r.id}`, createdBy: viewer.id,
        });
      } else if (r.cover_user_id) {
        paybackId = await bookAdjustment({
          type: "h4h", userId: r.cover_user_id, date: paybackDate, dayNight: paybackDn,
          coveringUserId: r.user_id, coveringName: r.user_name, notes: `Request #${r.id} payback`, createdBy: viewer.id,
        });
      }
    }

    await db.rawExec(
      `UPDATE shift_requests SET
         status = 'approved', outcome_at = NOW(), outcome_by_name = $2, outcome_note = $3,
         shift_adjustment_id = $4, payback_adjustment_id = $5, payback_date = $6::date, payback_day_night = $7, payback_watch = $8,
         payback_status = CASE WHEN $6::date IS NULL THEN NULL ELSE 'authorised' END,
         payback_signed_by_name = CASE WHEN $6::date IS NULL THEN NULL ELSE decided_by_name END,
         payback_signed_at = CASE WHEN $6::date IS NULL THEN NULL ELSE decided_at END,
         updated_at = NOW()
       WHERE id = $1`,
      r.id, viewer.name, note, adjustmentId, paybackId, paybackDate, paybackDn, paybackWatch
    );
    const paybackText = paybackDate ? `Payback: ${dayLabel(paybackDate)} (${paybackDn}). ` : "";
    await addEvent(r.id, viewer, "Approved on Kronos", `${paybackText}${note ?? ""}`.trim());

    const told = linkNote(r, `${TYPE_LABEL[r.type]} approved`, `${describe(r)} for ${r.user_name} was approved on Kronos. It's on the calendar now.`);
    await tell(r.user_id, viewer.id, told);
    await tell(r.cover_user_id, viewer.id, told);
    await tellSigners(r, viewer.id, told);

    await logActivity({
      user_id: viewer.id, action: "shift_request_outcome", entity_type: "shift_request", entity_id: String(r.id),
      details: { approved: true, shift_adjustment_id: adjustmentId },
    });
    return detailFor(r.id, viewer);
  }
);

export const withdrawRequest = api<{ id: number; reason?: string }, RequestDetail>(
  { auth: true, expose: true, method: "POST", path: "/shift-requests/:id/withdraw" },
  async ({ id, reason }) => {
    const viewer = await loadViewer();
    const r = await loadRequest(id);
    if (viewer.id !== r.user_id && !canDecide(asViewer(viewer), r)) {
      throw APIError.permissionDenied("Only the person asking or their WC/CC can withdraw this.");
    }
    if (!OPEN.includes(r.status)) throw APIError.failedPrecondition("This request can't be withdrawn now.");
    await db.rawExec(`UPDATE shift_requests SET status = 'withdrawn', updated_at = NOW() WHERE id = $1`, id);
    await addEvent(id, viewer, "Withdrawn", reason?.trim());
    const note = linkNote(r, `${TYPE_LABEL[r.type]} withdrawn`, `${describe(r)} for ${r.user_name} was withdrawn.`);
    await tell(r.user_id, viewer.id, note);
    await tell(r.cover_user_id, viewer.id, note);
    if (r.status !== "with_cover") await tellSigners(r, viewer.id, note);
    return detailFor(id, viewer);
  }
);

// ─── Head for Head payback, agreed later ──────────────────────────────────────
export const addPayback = api<{ id: number; payback_date: string; payback_day_night: DayNight }, RequestDetail>(
  { auth: true, expose: true, method: "POST", path: "/shift-requests/:id/payback" },
  async ({ id, payback_date, payback_day_night }) => {
    const viewer = await loadViewer();
    const r = await loadRequest(id);
    if (viewer.id !== r.user_id && viewer.id !== r.cover_user_id && !canDecide(asViewer(viewer), r)) {
      throw APIError.permissionDenied("Only the two people or their WC/CC can add this.");
    }
    if (r.type !== "h4h" || r.payback_date || !(OPEN.includes(r.status) || r.status === "approved")) {
      throw APIError.failedPrecondition("A payback can't be added to this request.");
    }
    if (!ISO.test(payback_date)) throw APIError.invalidArgument("Pick a payback date.");

    // Already booked: the payback goes straight on too (John, 9 Nov 2026),
    // and the WC/CC are told. An older request still being decided carries it
    // in front of the WC with the swap itself.
    const booked = r.status === "approved";
    let paybackId: number | null = null;
    if (booked && r.cover_user_id && r.user_id) {
      paybackId = await bookAdjustment({
        type: "h4h", userId: r.cover_user_id, date: payback_date, dayNight: payback_day_night,
        coveringUserId: r.user_id, coveringName: r.user_name, notes: `Request #${r.id} payback`, createdBy: viewer.id,
      });
    }
    await db.rawExec(
      `UPDATE shift_requests SET payback_date = $2::date, payback_day_night = $3, payback_status = $4,
              payback_adjustment_id = COALESCE($5, payback_adjustment_id), updated_at = NOW() WHERE id = $1`,
      id, payback_date, payback_day_night, booked ? "authorised" : null, paybackId
    );
    await addEvent(id, viewer, booked ? "Payback booked" : "Payback date added", `${dayLabel(payback_date)} (${payback_day_night})`);
    if (booked) {
      const note = linkNote(r, "Head for Head payback booked",
        `${r.user_name} pays back ${r.cover_name ?? "their cover"} on ${dayLabel(payback_date)} (${payback_day_night}). It's on the calendar.`);
      await notifyWatchManagers(r.watch, [viewer.id, r.user_id, r.cover_user_id].filter((x): x is string => !!x), note);
      await tell(r.user_id, viewer.id, note);
      await tell(r.cover_user_id, viewer.id, note);
    }
    return detailFor(id, viewer);
  }
);

export const decidePayback = api<{ id: number; authorised: boolean; comments?: string }, RequestDetail>(
  { auth: true, expose: true, method: "POST", path: "/shift-requests/:id/payback-decision" },
  async ({ id, authorised, comments }) => {
    const viewer = await loadViewer();
    const r = await loadRequest(id);
    if (!canDecide(asViewer(viewer), r)) throw APIError.permissionDenied("Only the watch's WC or CC can sign this.");
    if (r.payback_status !== "with_wc" || !r.payback_date || !r.payback_day_night) {
      throw APIError.failedPrecondition("There's no payback waiting on a decision.");
    }
    const why = comments?.trim() || null;
    if (!authorised) {
      if (!why) throw APIError.invalidArgument("Say why it's declined.");
      await db.rawExec(
        `UPDATE shift_requests SET payback_date = NULL, payback_day_night = NULL, payback_status = NULL, updated_at = NOW() WHERE id = $1`,
        id
      );
      await addEvent(id, viewer, `Payback declined by ${viewer.role}`, `${dayLabel(r.payback_date)}: ${why}`);
    } else {
      const flagged = ((await checksForRequest(r)) ?? []).find((c) => c.key === "payback_clash" && c.state === "fail");
      if (flagged && !why) throw APIError.invalidArgument("Say why you're going ahead despite the clash.");
      let paybackId: number | null = null;
      if (r.cover_user_id && r.user_id) {
        paybackId = await bookAdjustment({
          type: "h4h", userId: r.cover_user_id, date: r.payback_date, dayNight: r.payback_day_night,
          coveringUserId: r.user_id, coveringName: r.user_name, notes: `Request #${r.id} payback`, createdBy: viewer.id,
        });
      }
      await db.rawExec(
        `UPDATE shift_requests SET payback_status = 'authorised', payback_signed_by_name = $2, payback_signed_at = NOW(),
                payback_adjustment_id = $3, updated_at = NOW() WHERE id = $1`,
        id, viewer.name, paybackId
      );
      await addEvent(id, viewer, `Payback authorised by ${viewer.role}`, why);
    }
    const note = linkNote(r, authorised ? "Head for Head payback authorised" : "Head for Head payback declined",
      `The payback on ${dayLabel(r.payback_date)} (${r.payback_day_night}) was ${authorised ? "authorised" : "declined"} by ${viewer.name}.`);
    await tell(r.user_id, viewer.id, note);
    await tell(r.cover_user_id, viewer.id, note);
    return detailFor(id, viewer);
  }
);

// ─── Lists ────────────────────────────────────────────────────────────────────
interface ListRequest {
  /** review: yours to sign or waiting. mine: yours or that you're covering. records: the audit list. */
  scope: Query<string>;
  year?: Query<number>;
}

export const listRequests = api<ListRequest, { requests: ShiftRequest[] }>(
  { auth: true, expose: true, method: "GET", path: "/shift-requests" },
  async ({ scope, year }) => {
    const viewer = await loadViewer();
    const me = asViewer(viewer);
    if (scope === "mine") {
      const rows = await db.rawQueryAll<ShiftRequest>(
        `SELECT ${COLUMNS} FROM shift_requests WHERE user_id = $1 OR cover_user_id = $1 ORDER BY shift_date DESC, id DESC LIMIT 200`,
        viewer.id
      );
      return { requests: rows.map((r) => ({ ...r, checks: null })) };
    }
    if (!isManager(viewer)) throw APIError.permissionDenied("Only a WC or CC can see this list.");
    if (scope === "review") {
      // Anything older still waiting on a step, plus what's been booked
      // straight on from yesterday onwards, with its flags (the WC's view).
      const rows = await db.rawQueryAll<ShiftRequest>(
        `SELECT ${COLUMNS} FROM shift_requests
         WHERE status = ANY($1::text[]) OR payback_status = 'with_wc'
            OR (status = 'approved' AND shift_date >= $2::date)
         ORDER BY shift_date, id`,
        OPEN, addDaysIso(ukParts().date, -1)
      );
      return {
        requests: rows.filter((r) => canDecide(me, r)).map((r) => {
          const stored = (typeof r.checks === "string" ? JSON.parse(r.checks) : r.checks) as RequestCheck[] | null;
          return { ...r, checks: r.status === "approved" && stored ? stored : null };
        }),
      };
    }
    if (scope === "records") {
      const rows = await db.rawQueryAll<ShiftRequest>(
        `SELECT ${COLUMNS} FROM shift_requests WHERE EXTRACT(YEAR FROM shift_date)::int = $1 ORDER BY shift_date DESC, id DESC`,
        year ?? Number(ukParts().date.slice(0, 4))
      );
      return { requests: rows.filter((r) => canViewRequest(me, r)).map((r) => ({ ...r, checks: null })) };
    }
    throw APIError.invalidArgument("Unknown list.");
  }
);

/** Anything waiting on this person, for the menu badge and Needs you. */
export const requestsNeedingMe = api<void, { to_review: number; to_confirm: number; to_record: number }>(
  { auth: true, expose: true, method: "GET", path: "/shift-requests/needs-me" },
  async () => {
    const viewer = await loadViewer();
    const me = asViewer(viewer);
    const rows = await db.rawQueryAll<ShiftRequest>(
      `SELECT ${COLUMNS} FROM shift_requests WHERE status = ANY($1::text[]) OR payback_status = 'with_wc'`,
      OPEN
    );
    return {
      to_review: rows.filter((r) => canDecide(me, r) && (r.status === "with_wc" || r.payback_status === "with_wc")).length,
      to_confirm: rows.filter((r) => r.status === "with_cover" && r.cover_user_id === viewer.id).length,
      to_record: rows.filter((r) => (r.status === "authorised" || r.status === "referred") && r.user_id === viewer.id).length,
    };
  }
);

export const listReviewers = api<void, { reviewers: { id: string; name: string; watch: string | null }[] }>(
  { auth: true, expose: true, method: "GET", path: "/shift-requests/reviewers" },
  async () => {
    await loadViewer();
    const reviewers = await db.rawQueryAll<{ id: string; name: string; watch: string | null }>(
      `SELECT u.id, u.name, COALESCE(u.watch_unit, p.watch) AS watch
       FROM users u LEFT JOIN firefighter_profiles p ON p.user_id = u.id
       WHERE u.role = 'WC' AND u.left_at IS NULL
       ORDER BY u.name, 3`
    );
    return { reviewers };
  }
);

// ─── Flexi balances ───────────────────────────────────────────────────────────
interface BalanceRow {
  user_id: string;
  name: string;
  role: string;
  /** Used before the app kept count, entered by the WC. */
  opening: number;
  in_app: number;
}

interface BalancesResponse {
  year: number;
  watch: string;
  limits: FlexiLimits;
  can_edit_limits: boolean;
  can_edit: boolean;
  people: BalanceRow[];
}

const canEditBalances = (viewer: Person, watch: string) =>
  viewer.role === "WC" || (viewer.role === "CC" && viewer.watch?.toLowerCase() === watch.toLowerCase());

export const flexiBalances = api<{ watch?: Query<string>; year?: Query<number> }, BalancesResponse>(
  { auth: true, expose: true, method: "GET", path: "/shift-requests/balances" },
  async ({ watch, year }) => {
    const viewer = await loadViewer();
    if (!isManager(viewer)) throw APIError.permissionDenied("Only a WC or CC can see flexi balances.");
    const shown = watch || viewer.watch;
    if (!shown) throw APIError.invalidArgument("Pick a watch.");
    const y = year ?? Number(ukParts().date.slice(0, 4));
    const people = await db.rawQueryAll<BalanceRow>(
      `SELECT u.id AS user_id, u.name, u.role,
              COALESCE(b.used, 0)::int AS opening,
              (SELECT count(*)::int FROM shift_requests r
               WHERE r.type = 'flexi' AND r.user_id = u.id AND EXTRACT(YEAR FROM r.shift_date)::int = $2
                 AND r.status IN ('with_wc', 'authorised', 'approved')) AS in_app
       FROM users u
       LEFT JOIN firefighter_profiles p ON p.user_id = u.id
       LEFT JOIN flexi_opening_balances b ON b.user_id = u.id AND b.year = $2
       WHERE u.left_at IS NULL AND u.role IN ('WC', 'CC', 'FF')
         AND (LOWER(u.watch_unit) = LOWER($1) OR LOWER(p.watch) = LOWER($1))
       ORDER BY CASE u.role WHEN 'WC' THEN 1 WHEN 'CC' THEN 2 ELSE 3 END, u.name`,
      shown, y
    );
    return {
      year: y, watch: shown, limits: await loadLimits(),
      can_edit_limits: viewer.role === "WC", can_edit: canEditBalances(viewer, shown), people,
    };
  }
);

export const setFlexiOpening = api<{ user_id: string; year: number; used: number }, { ok: boolean }>(
  { auth: true, expose: true, method: "PUT", path: "/shift-requests/balances" },
  async ({ user_id, year, used }) => {
    const viewer = await loadViewer();
    const person = await loadPerson(user_id);
    if (!person) throw APIError.notFound("That person isn't on the system.");
    if (!isManager(viewer) || !person.watch || !canEditBalances(viewer, person.watch)) {
      throw APIError.permissionDenied("Only a WC, or the watch's CC, can set this.");
    }
    if (!Number.isInteger(used) || used < 0 || used > 99) throw APIError.invalidArgument("Enter a whole number.");
    await db.rawExec(
      `INSERT INTO flexi_opening_balances (user_id, year, used, set_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, year) DO UPDATE SET used = EXCLUDED.used, set_by = EXCLUDED.set_by, set_at = NOW()`,
      user_id, year, used, viewer.name
    );
    await logActivity({
      user_id: viewer.id, action: "set_flexi_opening", entity_type: "user", entity_id: user_id, details: { year, used },
    });
    return { ok: true };
  }
);

export const setFlexiLimits = api<FlexiLimits, FlexiLimits>(
  { auth: true, expose: true, method: "PATCH", path: "/shift-requests/limits" },
  async ({ per_year, days_ahead, notice_hours }) => {
    const viewer = await loadViewer();
    if (viewer.role !== "WC") throw APIError.permissionDenied("Only a WC can change these.");
    for (const n of [per_year, days_ahead, notice_hours]) {
      if (!Number.isInteger(n) || n < 0 || n > 1000) throw APIError.invalidArgument("Enter whole numbers.");
    }
    await db.rawExec(
      `UPDATE system_settings SET flexi_limit_per_year = $1, flexi_days_ahead = $2, flexi_notice_hours = $3, updated_at = NOW()
       WHERE id = (SELECT id FROM system_settings ORDER BY id DESC LIMIT 1)`,
      per_year, days_ahead, notice_hours
    );
    await logActivity({
      user_id: viewer.id, action: "set_flexi_limits", entity_type: "settings", entity_id: "flexi",
      details: { per_year, days_ahead, notice_hours },
    });
    return { per_year, days_ahead, notice_hours };
  }
);
