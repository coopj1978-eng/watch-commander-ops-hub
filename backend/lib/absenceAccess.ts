import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db, { type SQLPrimitive } from "../db";
import { notifyWatchManagers } from "../notification/helpers";

// Who may see and change absence (sickness) records.
//
//   • Everyone can see their own records — and only see them.
//   • A WC or CC can see and change the records of people on their own
//     watch (their line managers). Nobody manages their own.
//   • Nobody else can see them at all: not other firefighters, and not
//     WCs/CCs on other watches.
//
// A person's watch uses the COALESCE(users.watch_unit, firefighter_profiles
// .watch) lookup the rest of the app uses.

export interface AbsenceViewer {
  userID: string;
  isManager: boolean;
  /** The WC/CC's own watch; null for firefighters (or a manager with none). */
  watch: string | null;
}

async function watchOf(userId: string): Promise<string | null> {
  const row = await db.queryRow<{ watch: string | null }>`
    SELECT COALESCE(u.watch_unit, fp.watch) AS watch
    FROM users u
    LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
    WHERE u.id = ${userId}
  `;
  return row?.watch || null;
}

export async function absenceViewer(): Promise<AbsenceViewer> {
  const auth = getAuthData()!;
  const isManager = auth.role === "WC" || auth.role === "CC";
  return {
    userID: auth.userID,
    isManager,
    watch: isManager ? await watchOf(auth.userID) : null,
  };
}

/** A WC/CC on the person's watch — never the person themself. */
export async function canManageAbsencesOf(viewer: AbsenceViewer, personId: string): Promise<boolean> {
  if (personId === viewer.userID || !viewer.isManager || !viewer.watch) return false;
  const watch = await watchOf(personId);
  return !!watch && watch.toLowerCase() === viewer.watch.toLowerCase();
}

/** The person themself, or a WC/CC on their watch. */
export async function canViewAbsencesOf(viewer: AbsenceViewer, personId: string): Promise<boolean> {
  return personId === viewer.userID || canManageAbsencesOf(viewer, personId);
}

export async function assertCanManageAbsencesOf(viewer: AbsenceViewer, personId: string): Promise<void> {
  if (!(await canManageAbsencesOf(viewer, personId))) {
    throw APIError.permissionDenied(
      "Only a Watch Commander or Crew Commander on this person's watch can change their absence records."
    );
  }
}

export async function assertCanViewAbsencesOf(viewer: AbsenceViewer, personId: string): Promise<void> {
  if (!(await canViewAbsencesOf(viewer, personId))) {
    throw APIError.permissionDenied(
      "Absence records can only be seen by the person and the WC/CC on their watch."
    );
  }
}

/** Ids of everyone whose absence records the viewer may see. */
export async function visiblePersonIds(viewer: AbsenceViewer): Promise<Set<string>> {
  const ids = new Set([viewer.userID]);
  if (viewer.isManager && viewer.watch) {
    const rows = await db.rawQueryAll<{ id: string }>(
      `SELECT u.id FROM users u
       LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
       WHERE LOWER(COALESCE(u.watch_unit, fp.watch)) = LOWER($1)`,
      viewer.watch
    );
    for (const r of rows) ids.add(r.id);
  }
  return ids;
}

/**
 * Profiles carry each person's rolling sickness totals and trigger stage.
 * Blank them on profiles the viewer isn't allowed to see sickness for.
 */
export function redactSickness<
  P extends { user_id: string; rolling_sick_episodes: number; rolling_sick_days: number; trigger_stage: string }
>(profile: P, visible: Set<string>): P {
  if (visible.has(profile.user_id)) return profile;
  return { ...profile, rolling_sick_episodes: 0, rolling_sick_days: 0, trigger_stage: "None" };
}

/**
 * SQL condition limiting rows whose person id is in `column` to people the
 * viewer may see. Pushes its values onto `params` ($n placeholders follow
 * params.length).
 */
export function visibleAbsencesSql(viewer: AbsenceViewer, column: string, params: SQLPrimitive[]): string {
  params.push(viewer.userID);
  const self = `$${params.length}`;
  if (!viewer.isManager || !viewer.watch) return `${column} = ${self}`;
  params.push(viewer.watch);
  const watch = `$${params.length}`;
  return `(${column} = ${self} OR ${column} IN (
    SELECT u.id FROM users u
    LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
    WHERE LOWER(COALESCE(u.watch_unit, fp.watch)) = LOWER(${watch})
  ))`;
}

/**
 * Tell the person's own watch WC/CC they've crossed an absence trigger (each
 * rise, not every recalculation). No stage is named — that's the Station
 * Commander's decision for the attendance file. Never throws.
 */
export async function notifyTriggersHit(
  personId: string,
  totals: { episodes: number; days: number; further: boolean }
): Promise<void> {
  const row = await db.queryRow<{ name: string | null; email: string | null; watch: string | null }>`
    SELECT u.name, u.email, COALESCE(u.watch_unit, fp.watch) AS watch
    FROM users u
    LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
    WHERE u.id = ${personId}
  `.catch(() => null);
  if (!row?.watch) return;
  const name = row.name || row.email?.split("@")[0] || "Someone on your watch";
  const { episodes, days } = totals;
  await notifyWatchManagers(row.watch, [personId], {
    type: "sick_booking",
    title: "Absence triggers hit — see profile",
    message:
      `${name} has hit ${totals.further ? "a further absence trigger" : "their absence triggers"}: ` +
      `${episodes} sickness absence${episodes === 1 ? "" : "s"}, ${days} duty day${days === 1 ? "" : "s"} in 6 months.`,
    entity_type: "profile",
    entity_id: personId,
    link: `/people/${personId}`,
  });
}

/**
 * Tell the person's own watch WC/CC about a sickness change made by someone
 * else — booking off or back fit can be taken by any WC/CC on duty, but the
 * person's line managers must always hear about it. Never throws.
 */
export async function notifyLineManagers(
  personId: string,
  actorId: string,
  note: { title: string; message: string; absenceId: number }
): Promise<void> {
  const watch = await watchOf(personId).catch(() => null);
  if (!watch) return;
  await notifyWatchManagers(watch, [actorId, personId], {
    type: "sick_booking",
    title: note.title,
    message: note.message,
    entity_type: "absence",
    entity_id: String(note.absenceId),
    link: `/people/${personId}`,
  });
}
