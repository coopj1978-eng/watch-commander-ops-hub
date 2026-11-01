import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { requireRole } from "../auth/rbac";
import {
  ACTION_CODE_MAX, DEFECT_CODES, HYDRANT_CYCLE_START, HYDRANT_WATCHES, INSPECTION_CODE_MAX, UNABLE_CODES,
  compareRoutes, cycleYear, groupFor, groupLabel, groupOfRoute, routeInGroup, ukYear, watchForRoute,
} from "../lib/hydrantRota";

// Hydrant routes (Nov 2026). The station's hydrants, one per line of the SP
// route sheets, and each year's inspection of them. The watch that has a
// route in a year comes from the rota (lib/hydrantRota.ts), never the client.
// The target is every in-use hydrant on the watch's routes; anyone on that
// watch can tick one (their name is kept), and any WC or CC can correct it.

export interface Hydrant {
  id: number;
  route: string;
  seq: number;
  ref: string | null;
  street: string;
  location: string | null;
  main_size: string | null;
  surface: string | null;
  marker: string | null;
  dist: string | null;
  in_use: boolean;
}

export interface HydrantInspection {
  hydrant_id: number;
  year: number;
  watch: string;
  lid_ok: boolean | null;
  trip_hazard: boolean | null;
  inspection_codes: number[];
  action_codes: number[];
  comment: string | null;
  inspected_by: string;
  inspected_by_name: string | null;
  inspected_at: string;
  /** When it went in a fault report (not fully functional only); null = not yet. */
  reported_at: string | null;
  reported_by_name: string | null;
}

export interface RouteHydrant {
  id: number;
  route: string;
  seq: number;
  ref: string | null;
  street: string;
  location: string | null;
  main_size: string | null;
  surface: string | null;
  marker: string | null;
  dist: string | null;
  in_use: boolean;
  inspection: HydrantInspection | null;
}

export interface HydrantRoute {
  route: string;
  hydrants: RouteHydrant[];
}

export interface HydrantRouteResponse {
  year: number;
  /** 1–15, where the year sits in the rota. */
  cycle_year: number;
  watch: string;
  /** "SP 27 – 28B", or null for an unknown watch. */
  label: string | null;
  routes: HydrantRoute[];
  /** In-use hydrants on the routes — the target. */
  total: number;
  done: number;
  /** Ticked with an "unable to inspect" code (2–5). */
  unable: number;
  /** Ticked with an unsatisfactory code (7–13). */
  defects: number;
  /** Not fully functional — a problem code, lid not secured or a trip hazard. */
  faults: number;
  /** Faults not yet in a report. */
  to_report: number;
  /** False until the routes have been imported. */
  loaded: boolean;
  can_edit: boolean;
}

export interface HydrantWatchSummary {
  watch: string;
  label: string;
  total: number;
  done: number;
  defects: number;
  faults: number;
}

export interface HydrantSummaryResponse {
  year: number;
  cycle_year: number;
  watches: HydrantWatchSummary[];
  loaded: boolean;
}

export interface SaveHydrantInspectionRequest {
  id: number;
  year: number;
  lid_ok?: boolean | null;
  trip_hazard?: boolean | null;
  inspection_codes?: number[];
  action_codes?: number[];
  comment?: string | null;
}

export interface ImportHydrant {
  route: string;
  seq: number;
  ref?: string | null;
  street: string;
  location?: string | null;
  main_size?: string | null;
  surface?: string | null;
  marker?: string | null;
  dist?: string | null;
  in_use: boolean;
}

type InspectionRow = Omit<HydrantInspection, "inspected_at" | "reported_at"> & { inspected_at: Date | string; reported_at: Date | string | null };

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : d);
// jsonb comes back parsed. The codes are sent as JSON text cast in SQL
// ($n::text::jsonb) — a bare $n::jsonb makes Encore store a JSON string.
const codes = (v: unknown): number[] => {
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  return Array.isArray(arr) ? arr.map(Number).filter(Number.isInteger) : [];
};
const toInspection = (r: InspectionRow): HydrantInspection => ({
  hydrant_id: r.hydrant_id,
  year: r.year,
  watch: r.watch,
  lid_ok: r.lid_ok,
  trip_hazard: r.trip_hazard,
  inspection_codes: codes(r.inspection_codes),
  action_codes: codes(r.action_codes),
  comment: r.comment,
  inspected_by: r.inspected_by,
  inspected_by_name: r.inspected_by_name,
  inspected_at: iso(r.inspected_at),
  reported_at: r.reported_at ? iso(r.reported_at) : null,
  reported_by_name: r.reported_by_name ?? null,
});

const isUnable = (i: HydrantInspection) => i.inspection_codes.some((c) => UNABLE_CODES.includes(c));
const isDefect = (i: HydrantInspection) => i.inspection_codes.some((c) => DEFECT_CODES.includes(c));
/** Goes in the fault report: anything but fully functional (1) or newly adopted (6), lid not secured, or a trip hazard. */
const isFault = (i: HydrantInspection) =>
  i.inspection_codes.some((c) => c !== 1 && c !== 6) || i.lid_ok === false || i.trip_hazard === true;

function checkYear(year: number): number {
  const y = Number(year);
  if (!Number.isInteger(y) || y < HYDRANT_CYCLE_START || y > ukYear() + 1) {
    throw APIError.invalidArgument(`Pick a year from ${HYDRANT_CYCLE_START} on.`);
  }
  return y;
}

function canRecord(watch: string): boolean {
  const auth = getAuthData()!;
  return auth.role === "WC" || auth.role === "CC" || (auth.watchUnit ?? "").toLowerCase() === watch.toLowerCase();
}

async function allHydrants(): Promise<Hydrant[]> {
  return db.rawQueryAll<Hydrant>(
    `SELECT id, route, seq, ref, street, location, main_size, surface, marker, dist, in_use FROM hydrants`
  );
}

async function inspectionsFor(year: number): Promise<Map<number, HydrantInspection>> {
  const rows = await db.rawQueryAll<InspectionRow>(
    `SELECT hydrant_id, year, watch, lid_ok, trip_hazard, inspection_codes, action_codes, comment,
            inspected_by, inspected_by_name, inspected_at, reported_at, reported_by_name
     FROM hydrant_inspections WHERE year = $1`,
    year
  );
  return new Map(rows.map((r) => [r.hydrant_id, toInspection(r)]));
}

// GET /hydrants/route — one watch's routes for a year, hydrant by hydrant.
export const getHydrantRoute = api(
  { auth: true, expose: true, method: "GET", path: "/hydrants/route" },
  async (req: { watch?: string; year?: number }): Promise<HydrantRouteResponse> => {
    const auth = getAuthData()!;
    const year = checkYear(req.year ? Number(req.year) : ukYear());
    const watch = HYDRANT_WATCHES.find((w) => w.toLowerCase() === (req.watch || auth.watchUnit || "").toLowerCase()) ?? (req.watch || auth.watchUnit || "");
    const group = groupFor(watch, year);
    const base = { year, cycle_year: cycleYear(year), watch, can_edit: group !== null && canRecord(watch) };
    if (group === null) {
      return { ...base, label: null, routes: [], total: 0, done: 0, unable: 0, defects: 0, faults: 0, to_report: 0, loaded: false };
    }

    const [hydrants, inspections] = await Promise.all([allHydrants(), inspectionsFor(year)]);
    const byRoute = new Map<string, RouteHydrant[]>();
    let total = 0, done = 0, unable = 0, defects = 0, faults = 0, toReport = 0;
    for (const h of hydrants) {
      if (!routeInGroup(h.route, group)) continue;
      const inspection = inspections.get(h.id) ?? null;
      if (!byRoute.has(h.route)) byRoute.set(h.route, []);
      byRoute.get(h.route)!.push({ ...h, inspection });
      if (h.in_use) total++;
      if (inspection && h.in_use) {
        done++;
        if (isUnable(inspection)) unable++;
        if (isDefect(inspection)) defects++;
        if (isFault(inspection)) {
          faults++;
          if (!inspection.reported_at) toReport++;
        }
      }
    }
    const routes = [...byRoute.entries()]
      .sort(([a], [b]) => compareRoutes(a, b))
      .map(([route, list]) => ({ route, hydrants: list.sort((a, b) => a.seq - b.seq) }));

    return { ...base, label: groupLabel(group), routes, total, done, unable, defects, faults, to_report: toReport, loaded: hydrants.length > 0 };
  }
);

// GET /hydrants/summary — every watch's hydrant total and progress for a year.
export const getHydrantSummary = api(
  { auth: true, expose: true, method: "GET", path: "/hydrants/summary" },
  async (req: { year?: number }): Promise<HydrantSummaryResponse> => {
    const year = checkYear(req.year ? Number(req.year) : ukYear());
    const [hydrants, inspections] = await Promise.all([allHydrants(), inspectionsFor(year)]);
    const watches = HYDRANT_WATCHES.map((watch) => {
      const group = groupFor(watch, year)!;
      let total = 0, done = 0, defects = 0, faults = 0;
      for (const h of hydrants) {
        if (!h.in_use || !routeInGroup(h.route, group)) continue;
        total++;
        const i = inspections.get(h.id);
        if (i) {
          done++;
          if (isDefect(i)) defects++;
          if (isFault(i)) faults++;
        }
      }
      return { watch, label: groupLabel(group), total, done, defects, faults };
    });
    return { year, cycle_year: cycleYear(year), watches, loaded: hydrants.length > 0 };
  }
);

async function hydrantWatch(id: number, year: number): Promise<{ hydrant: Hydrant; watch: string }> {
  const hydrant = await db.rawQueryRow<Hydrant>(
    `SELECT id, route, seq, ref, street, location, main_size, surface, marker, dist, in_use FROM hydrants WHERE id = $1`,
    id
  );
  if (!hydrant) throw APIError.notFound("Hydrant not found");
  const watch = watchForRoute(hydrant.route, year);
  if (!watch) throw APIError.invalidArgument(`SP ${hydrant.route} isn't on any watch's route in ${year}.`);
  if (!canRecord(watch)) {
    throw APIError.permissionDenied(`SP ${hydrant.route} is ${watch} Watch's route in ${year} — only ${watch} Watch or a WC/CC can record it.`);
  }
  return { hydrant, watch };
}

function cleanCodes(codes: number[] | undefined, max: number, what: string): number[] | undefined {
  if (codes === undefined) return undefined;
  const out = [...new Set(codes.map(Number))].sort((a, b) => a - b);
  if (out.some((c) => !Number.isInteger(c) || c < 1 || c > max)) {
    throw APIError.invalidArgument(`${what} codes run from 1 to ${max}.`);
  }
  return out;
}

// PUT /hydrants/:id/inspection — tick a hydrant, or change its result. The
// first tick is the usual result (1 Fully functional, 1 Tested, lid secured,
// no trip hazard); send only what's different.
export const saveHydrantInspection = api(
  { auth: true, expose: true, method: "PUT", path: "/hydrants/:id/inspection" },
  async (req: SaveHydrantInspectionRequest): Promise<HydrantInspection> => {
    const auth = getAuthData()!;
    const year = checkYear(req.year);
    if (year > ukYear()) throw APIError.invalidArgument(`${year} hasn't started yet.`);
    const { hydrant, watch } = await hydrantWatch(req.id, year);
    const inspection = cleanCodes(req.inspection_codes, INSPECTION_CODE_MAX, "Inspection");
    const action = cleanCodes(req.action_codes, ACTION_CODE_MAX, "Action");
    const comment = req.comment === undefined ? undefined : (req.comment ?? "").trim().slice(0, 500) || null;

    const before = await db.rawQueryRow<InspectionRow>(
      `SELECT hydrant_id, year, watch, lid_ok, trip_hazard, inspection_codes, action_codes, comment,
              inspected_by, inspected_by_name, inspected_at, reported_at, reported_by_name
       FROM hydrant_inspections WHERE hydrant_id = $1 AND year = $2`,
      hydrant.id, year
    );
    const row = await db.rawQueryRow<InspectionRow>(
      `INSERT INTO hydrant_inspections
         (hydrant_id, year, watch, lid_ok, trip_hazard, inspection_codes, action_codes, comment, inspected_by, inspected_by_name)
       VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7::text::jsonb, $8, $9, (SELECT name FROM users WHERE id = $9))
       ON CONFLICT (hydrant_id, year) DO UPDATE SET
         lid_ok = EXCLUDED.lid_ok, trip_hazard = EXCLUDED.trip_hazard,
         inspection_codes = EXCLUDED.inspection_codes, action_codes = EXCLUDED.action_codes,
         comment = EXCLUDED.comment, updated_at = NOW(),
         -- a result that changes after it was reported goes in the next report
         reported_at = CASE WHEN hydrant_inspections.lid_ok IS NOT DISTINCT FROM EXCLUDED.lid_ok
                              AND hydrant_inspections.trip_hazard IS NOT DISTINCT FROM EXCLUDED.trip_hazard
                              AND hydrant_inspections.inspection_codes = EXCLUDED.inspection_codes
                              AND hydrant_inspections.action_codes = EXCLUDED.action_codes
                              AND hydrant_inspections.comment IS NOT DISTINCT FROM EXCLUDED.comment
                            THEN hydrant_inspections.reported_at END
       RETURNING hydrant_id, year, watch, lid_ok, trip_hazard, inspection_codes, action_codes, comment,
                 inspected_by, inspected_by_name, inspected_at, reported_at, reported_by_name`,
      hydrant.id, year, watch,
      req.lid_ok !== undefined ? req.lid_ok : before ? before.lid_ok : true,
      req.trip_hazard !== undefined ? req.trip_hazard : before ? before.trip_hazard : false,
      JSON.stringify(inspection ?? (before ? codes(before.inspection_codes) : [1])),
      JSON.stringify(action ?? (before ? codes(before.action_codes) : [1])),
      comment !== undefined ? comment : before?.comment ?? null,
      auth.userID
    );
    if (!row) throw APIError.internal("Couldn't save the inspection");
    return toInspection(row);
  }
);

// DELETE /hydrants/:id/inspection — untick.
export const clearHydrantInspection = api(
  { auth: true, expose: true, method: "DELETE", path: "/hydrants/:id/inspection" },
  async (req: { id: number; year: number }): Promise<void> => {
    const year = checkYear(Number(req.year));
    const { hydrant } = await hydrantWatch(req.id, year);
    await db.rawExec(`DELETE FROM hydrant_inspections WHERE hydrant_id = $1 AND year = $2`, hydrant.id, year);
  }
);

// POST /hydrants/reported — after the fault report is emailed, mark those
// hydrants reported so the next report has only new ones (WC/CC).
export const markHydrantsReported = api(
  { auth: true, expose: true, method: "POST", path: "/hydrants/reported" },
  async (req: { year: number; hydrant_ids: number[] }): Promise<{ marked: number }> => {
    const auth = getAuthData()!;
    requireRole(auth, "WC", "CC");
    const year = checkYear(req.year);
    const ids = (req.hydrant_ids ?? []).map(Number).filter(Number.isInteger);
    if (ids.length === 0) return { marked: 0 };
    const rows = await db.rawQueryAll<{ hydrant_id: number }>(
      `UPDATE hydrant_inspections
       SET reported_at = NOW(), reported_by_name = (SELECT name FROM users WHERE id = $3)
       WHERE year = $1 AND hydrant_id = ANY($2::int[]) AND reported_at IS NULL
       RETURNING hydrant_id`,
      year, ids, auth.userID
    );
    return { marked: rows.length };
  }
);

// PATCH /hydrants/:id — mark a hydrant abandoned/removed (or back in use), WC/CC.
// Not-in-use hydrants stay on the route list but drop out of the target.
export const setHydrantInUse = api(
  { auth: true, expose: true, method: "PATCH", path: "/hydrants/:id" },
  async (req: { id: number; in_use: boolean }): Promise<Hydrant> => {
    requireRole(getAuthData()!, "WC", "CC");
    const row = await db.rawQueryRow<Hydrant>(
      `UPDATE hydrants SET in_use = $2, updated_at = NOW() WHERE id = $1
       RETURNING id, route, seq, ref, street, location, main_size, surface, marker, dist, in_use`,
      req.id, !!req.in_use
    );
    if (!row) throw APIError.notFound("Hydrant not found");
    return row;
  }
);

// POST /hydrants/import — load or refresh the route sheets (WC/CC). Matches
// on route + hydrant number, so inspections already recorded are kept, and a
// hydrant someone marked not in use stays that way.
export const importHydrants = api(
  { auth: true, expose: true, method: "POST", path: "/hydrants/import" },
  async (req: { hydrants: ImportHydrant[] }): Promise<{ created: number; updated: number }> => {
    requireRole(getAuthData()!, "WC", "CC");
    const rows = req.hydrants ?? [];
    const bad = rows.find((h) => !h.route?.trim() || !Number.isInteger(h.seq) || !h.street?.trim() || groupOfRoute(h.route) === null);
    if (bad) throw APIError.invalidArgument(`Row SP ${bad.route} #${bad.seq} isn't on any route in the rota.`);

    let created = 0, updated = 0;
    const tx = await db.begin();
    try {
      for (const h of rows) {
        const r = await tx.rawQueryRow<{ inserted: boolean }>(
          `INSERT INTO hydrants (route, seq, ref, street, location, main_size, surface, marker, dist, in_use)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (route, seq) DO UPDATE SET
             ref = EXCLUDED.ref, street = EXCLUDED.street, location = EXCLUDED.location,
             main_size = EXCLUDED.main_size, surface = EXCLUDED.surface, marker = EXCLUDED.marker,
             dist = EXCLUDED.dist, in_use = hydrants.in_use AND EXCLUDED.in_use, updated_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
          h.route.trim().toUpperCase(), h.seq, h.ref?.trim() || null, h.street.trim(), h.location?.trim() || null,
          h.main_size?.trim() || null, h.surface?.trim() || null, h.marker?.trim() || null, h.dist?.trim() || null, h.in_use
        );
        r?.inserted ? created++ : updated++;
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
    return { created, updated };
  }
);
