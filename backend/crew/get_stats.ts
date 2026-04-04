import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import type { CrewStats } from "./types";

export const getStats = api<void, CrewStats>(
  { auth: true, expose: true, method: "GET", path: "/crew/stats" },
  async () => {
    const auth = getAuthData();
    if (!auth) throw new Error("Unauthorized");

    // All watch members (any role) for task counting
    const watchMembers = await db.rawQueryAll<{ id: string; watch_unit: string; role: string }>(
      `SELECT u.id, u.watch_unit, u.role
       FROM users u
       WHERE u.watch_unit = (SELECT watch_unit FROM users WHERE id = $1)
         AND u.is_active = true`,
      auth.userID
    );

    // Firefighters only for staffing count and one-to-ones
    const total_firefighters = watchMembers.filter((m) => m.role === "FF").length;
    const watchMemberIds = watchMembers.map((r) => r.id);
    const crewMemberIds = watchMembers.filter((m) => m.role === "FF").map((r) => r.id);

    if (watchMemberIds.length === 0) {
      return {
        total_firefighters: 0,
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
      total_tasks,
      completed_tasks,
      overdue_tasks,
      upcoming_inspections: inspections.length,
      overdue_one_to_ones: oneToOnes.length,
      completion_rate: Math.round(completion_rate),
    };
  }
);
