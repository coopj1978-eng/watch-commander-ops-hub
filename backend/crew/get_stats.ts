import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { CrewStats } from "./types";

export const getStats = api<void, CrewStats>(
  { auth: true, expose: true, method: "GET", path: "/crew/stats" },
  async () => {
    const auth = getAuthData();
    if (!auth) throw new Error("Unauthorized");

    // All watch members (any role) for task counting.
    // - Case-insensitive to tolerate inconsistent casing across rows.
    // - Resolves the caller's own watch via COALESCE(users.watch_unit,
    //   firefighter_profiles.watch) so a caller whose users.watch_unit is NULL
    //   (legacy accounts) still gets the right watch.
    // - Matches other members on EITHER column for the same reason — ensures
    //   every watch member is counted even if one of the two columns drifted.
    const watchMembers = await db.rawQueryAll<{ id: string; watch_unit: string; role: string }>(
      `WITH caller AS (
         SELECT LOWER(COALESCE(u.watch_unit, fp.watch)) AS watch
         FROM users u
         LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
         WHERE u.id = $1
       )
       SELECT u.id, u.watch_unit, u.role
       FROM users u
       LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
       WHERE (LOWER(u.watch_unit) = (SELECT watch FROM caller)
           OR LOWER(fp.watch)     = (SELECT watch FROM caller))
         AND u.is_active = true
         AND (SELECT watch FROM caller) IS NOT NULL`,
      auth.userID
    );

    // Firefighters only for staffing count and one-to-ones
    const total_firefighters = watchMembers.filter((m) => m.role === "FF").length;
    const watchMemberIds = watchMembers.map((r) => r.id);
    const crewMemberIds = watchMembers.filter((m) => m.role === "FF").map((r) => r.id);
    const total_watch_members = watchMembers.length;

    if (watchMemberIds.length === 0) {
      return {
        total_firefighters: 0,
        total_watch_members: 0,
        watch_member_ids: [],
        total_tasks: 0,
        completed_tasks: 0,
        overdue_tasks: 0,
        upcoming_inspections: 0,
        overdue_one_to_ones: 0,
        completion_rate: 0,
      };
    }

    // Count tasks for everyone on the watch (FF, CC, WC)
    const tasks = await db.rawQueryAll<{ status: string; due_at: Date | null }>(
      `SELECT status, due_at
       FROM tasks
       WHERE assigned_to_user_id = ANY($1)`,
      watchMemberIds
    );

    const total_tasks = tasks.length;
    const completed_tasks = tasks.filter((t) => t.status === "Done").length;
    const overdue_tasks = tasks.filter((t) => {
      if (!t.due_at || t.status === "Done") return false;
      return new Date(t.due_at) < new Date();
    }).length;

    const inspections = await db.rawQueryAll<{ id: number }>(
      `SELECT id
       FROM inspections
       WHERE assigned_crew_ids && $1
         AND status != 'Complete'
         AND scheduled_for >= NOW()
         AND scheduled_for <= NOW() + INTERVAL '14 days'`,
      watchMemberIds
    );

    const oneToOnes = await db.rawQueryAll<{ next_one_to_one_date: Date }>(
      `SELECT fp.next_one_to_one_date
       FROM firefighter_profiles fp
       WHERE fp.user_id = ANY($1)
         AND fp.next_one_to_one_date IS NOT NULL
         AND fp.next_one_to_one_date < NOW()`,
      crewMemberIds
    );

    const completion_rate = total_tasks > 0 ? (completed_tasks / total_tasks) * 100 : 0;

    return {
      total_firefighters,
      total_watch_members,
      watch_member_ids: watchMemberIds,
      total_tasks,
      completed_tasks,
      overdue_tasks,
      upcoming_inspections: inspections.length,
      overdue_one_to_ones: oneToOnes.length,
      completion_rate: Math.round(completion_rate),
    };
  }
);
