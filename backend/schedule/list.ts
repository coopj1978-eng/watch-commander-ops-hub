import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

// ─────────────────────────────────────────────────────────────────────────────
// GET /schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Unified "what's coming up" feed for the dashboard. Aggregates across
// inspections, training, one-to-ones, and generic calendar events so the
// dashboard only needs one round-trip to populate the "Scheduled today &
// tomorrow" table.
//
// Watch scoping:
//   • Inspections — station-level; shown to everyone regardless of watch.
//     Rationale: HFSV / High-Rise / Hydrant work is typically attended by
//     whichever crew is on shift, not owned by a specific watch.
//   • Training — scoped to the caller's watch.
//   • One-to-Ones — scoped to the caller's watch (surfaces 1:1 dates for
//     FFs the caller line-manages).
//   • Calendar events — all matching the range; calendar already has its
//     own watch-event flag we could filter by later if noise grows.
//
// Returns events sorted ascending by `when`. The frontend groups by day.
// ─────────────────────────────────────────────────────────────────────────────

export type ScheduleEventType =
  | "hfsv"
  | "high_rise"
  | "hydrant"
  | "drill"
  | "one_to_one"
  | "meeting"
  | "maintenance"
  | "reminder"
  | "other";

export interface ScheduleCrewMember {
  id: string;
  name: string;
  initials: string;
}

export interface ScheduleEvent {
  /** Stable id — prefixed by source table so the frontend can key on it
   *  and link through without ambiguity (e.g. `insp-42`, `train-17`). */
  id: string;
  type: ScheduleEventType;
  when: string; // ISO datetime
  end_when?: string;
  what: string;
  /** Display prefix before `what` — usually the event's category label. */
  location?: string;
  is_critical?: boolean;
  crew: ScheduleCrewMember[];
  /** Relative frontend route for the "Open ›" action. */
  link: string;
}

interface ListScheduleRequest {
  from?: Query<string>;
  to?: Query<string>;
}

interface ListScheduleResponse {
  events: ScheduleEvent[];
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const list = api<ListScheduleRequest, ListScheduleResponse>(
  { auth: true, expose: true, method: "GET", path: "/schedule" },
  async (req) => {
    const auth = getAuthData()!;

    // Default range: today 00:00 → day-after-tomorrow 00:00 (48h window).
    const from = req.from
      ? new Date(req.from + "T00:00:00")
      : new Date(new Date().setHours(0, 0, 0, 0));
    const to = req.to
      ? new Date(req.to + "T23:59:59")
      : new Date(from.getTime() + 48 * 60 * 60 * 1000);

    const caller = await db.queryRow<{ watch_unit: string | null }>`
      SELECT LOWER(u.watch_unit) AS watch_unit
      FROM users u
      LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
      WHERE u.id = ${auth.userID}
    `;
    const callerWatch = caller?.watch_unit ?? null;

    const events: ScheduleEvent[] = [];

    // ── 1. Inspections ───────────────────────────────────────────────────────
    // LocalProperty → HFSV, HighRise → high_rise, Hydrant → hydrant.
    // Crew resolved via assigned_crew_ids[] ↔ users.
    const inspections = await db.rawQueryAll<{
      id: number;
      type: string;
      address: string;
      priority: string;
      scheduled_for: Date;
      assigned_crew_ids: string[] | null;
      status: string;
    }>(
      `SELECT id, type, address, priority, scheduled_for, assigned_crew_ids, status
       FROM inspections
       WHERE scheduled_for >= $1
         AND scheduled_for < $2
         AND status != 'Complete'
       ORDER BY scheduled_for ASC`,
      from,
      to
    );

    if (inspections.length > 0) {
      // Flatten all referenced crew ids in one pass so we only hit users once.
      const crewIds = Array.from(
        new Set(inspections.flatMap((i) => i.assigned_crew_ids ?? []))
      );
      const crewLookup = new Map<string, { name: string }>();
      if (crewIds.length > 0) {
        const crewRows = await db.rawQueryAll<{ id: string; name: string }>(
          `SELECT id, name FROM users WHERE id = ANY($1)`,
          crewIds
        );
        for (const r of crewRows) crewLookup.set(r.id, { name: r.name });
      }

      for (const ins of inspections) {
        const type: ScheduleEventType =
          ins.type === "HighRise"
            ? "high_rise"
            : ins.type === "Hydrant"
            ? "hydrant"
            : ins.type === "LocalProperty"
            ? "hfsv"
            : "other";

        const crew: ScheduleCrewMember[] = (ins.assigned_crew_ids ?? [])
          .map((id) => {
            const found = crewLookup.get(id);
            if (!found) return null;
            return { id, name: found.name, initials: initialsFromName(found.name) };
          })
          .filter((c): c is ScheduleCrewMember => c !== null);

        events.push({
          id: `insp-${ins.id}`,
          type,
          when: ins.scheduled_for.toISOString(),
          what: ins.address,
          is_critical: ins.priority === "critical",
          crew,
          link: "/inspections",
        });
      }
    }

    // ── 2. Training / drills ────────────────────────────────────────────────
    // Only the caller's watch. Attendees pulled from training_attendance.
    if (callerWatch) {
      const trainings = await db.rawQueryAll<{
        id: number;
        watch: string;
        training_date: Date;
        training_type: string;
        topic: string;
        status: string;
      }>(
        `SELECT id, watch, training_date, training_type, topic, status
         FROM training_records
         WHERE LOWER(watch) = $1
           AND training_date >= $2::date
           AND training_date <= $3::date
           AND status = 'planned'
         ORDER BY training_date ASC`,
        callerWatch,
        from,
        to
      );

      if (trainings.length > 0) {
        const trainingIds = trainings.map((t) => t.id);
        const attendanceRows = await db.rawQueryAll<{
          training_id: number;
          user_id: string;
          name: string | null;
        }>(
          `SELECT ta.training_id, ta.user_id, u.name
           FROM training_attendance ta
           LEFT JOIN users u ON u.id = ta.user_id
           WHERE ta.training_id = ANY($1)`,
          trainingIds
        );
        const attendeesByTraining = new Map<number, ScheduleCrewMember[]>();
        for (const row of attendanceRows) {
          const list = attendeesByTraining.get(row.training_id) ?? [];
          if (row.name) {
            list.push({
              id: row.user_id,
              name: row.name,
              initials: initialsFromName(row.name),
            });
          }
          attendeesByTraining.set(row.training_id, list);
        }

        for (const t of trainings) {
          events.push({
            id: `train-${t.id}`,
            type: "drill",
            // training_date is date-only; default to 09:00 so it sorts sanely
            // alongside timestamped inspections.
            when: new Date(
              t.training_date.toISOString().split("T")[0] + "T09:00:00"
            ).toISOString(),
            what: `${t.topic}${
              t.training_type !== "other" ? ` (${t.training_type})` : ""
            }`,
            crew: attendeesByTraining.get(t.id) ?? [],
            link: "/training",
          });
        }
      }
    }

    // ── 3. One-to-Ones ──────────────────────────────────────────────────────
    // The "crew" for a 1:1 is the firefighter whose review it is.
    if (callerWatch) {
      const oneToOnes = await db.rawQueryAll<{
        user_id: string;
        name: string;
        next_one_to_one_date: Date;
        trigger_stage: string | null;
      }>(
        `SELECT fp.user_id, u.name, fp.next_one_to_one_date, fp.trigger_stage
         FROM firefighter_profiles fp
         JOIN users u ON u.id = fp.user_id
         WHERE fp.next_one_to_one_date IS NOT NULL
           AND fp.next_one_to_one_date >= $1::date
           AND fp.next_one_to_one_date <= $2::date
           AND (LOWER(u.watch_unit) = $3 OR LOWER(fp.watch) = $3)
           AND u.left_at IS NULL
         ORDER BY fp.next_one_to_one_date ASC`,
        from,
        to,
        callerWatch
      );

      for (const o of oneToOnes) {
        // Stage-3 sickness 1:1s are higher-priority — mark them critical so
        // the UI surfaces the red dot.
        const stage3 = o.trigger_stage === "Stage3";
        const what = stage3
          ? `${o.name} (Stage 3 absence review)`
          : o.name;

        events.push({
          id: `oto-${o.user_id}`,
          type: "one_to_one",
          when: new Date(
            o.next_one_to_one_date.toISOString().split("T")[0] + "T09:00:00"
          ).toISOString(),
          what,
          is_critical: stage3,
          crew: [
            {
              id: o.user_id,
              name: o.name,
              initials: initialsFromName(o.name),
            },
          ],
          link: `/people/${encodeURIComponent(o.user_id)}`,
        });
      }
    }

    // ── 4. Calendar events (meetings / maintenance / reminders) ──────────────
    // Leave calendar rows of event_type="inspection" / "training" out so we
    // don't double-count ones that shadow a real inspections/training row.
    const calEvents = await db.rawQueryAll<{
      id: number;
      title: string;
      event_type: string;
      start_time: Date;
      end_time: Date | null;
      attendees: string[] | null;
    }>(
      `SELECT id, title, event_type, start_time, end_time, attendees
       FROM calendar_events
       WHERE start_time >= $1
         AND start_time < $2
         AND event_type NOT IN ('inspection', 'training')
       ORDER BY start_time ASC`,
      from,
      to
    );

    if (calEvents.length > 0) {
      // Resolve attendee names from the attendees TEXT[] if it contains user ids.
      const attendeeIds = Array.from(
        new Set(calEvents.flatMap((e) => e.attendees ?? []))
      );
      const attendeeLookup = new Map<string, string>();
      if (attendeeIds.length > 0) {
        const rows = await db.rawQueryAll<{ id: string; name: string }>(
          `SELECT id, name FROM users WHERE id = ANY($1)`,
          attendeeIds
        );
        for (const r of rows) attendeeLookup.set(r.id, r.name);
      }

      for (const c of calEvents) {
        const type: ScheduleEventType =
          c.event_type === "meeting"
            ? "meeting"
            : c.event_type === "maintenance"
            ? "maintenance"
            : c.event_type === "reminder"
            ? "reminder"
            : "other";

        const crew: ScheduleCrewMember[] = (c.attendees ?? [])
          .map((idOrName) => {
            const mappedName = attendeeLookup.get(idOrName);
            // If it's not a user id, treat it as a free-text name.
            const name = mappedName ?? idOrName;
            return {
              id: idOrName,
              name,
              initials: initialsFromName(name),
            };
          })
          .slice(0, 6); // cap in the API so massive attendee lists don't bloat

        events.push({
          id: `cal-${c.id}`,
          type,
          when: c.start_time.toISOString(),
          end_when: c.end_time?.toISOString(),
          what: c.title,
          crew,
          link: "/calendar",
        });
      }
    }

    // Final sort — merged sources need to be chronological for the frontend.
    events.sort(
      (a, b) => new Date(a.when).getTime() - new Date(b.when).getTime()
    );

    return { events };
  }
);
