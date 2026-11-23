import { APIError } from "encore.dev/api";
import db from "../db";
import type { AuthData } from "../auth/auth";
import { atHomeStation } from "../lib/station";
import { assignRefusal, assignedNote } from "../lib/taskAssign";
import { createNotification } from "../notification/helpers";

/**
 * Who a task is being given to, checked: undefined when the request doesn't
 * say, null for nobody ("" in a request), else the person's id. Only a
 * WC/CC or the admin can give a task to someone else, and only to someone
 * still at this station (any watch).
 */
export async function vetAssignee(auth: AuthData, requested: string | null | undefined): Promise<string | null | undefined> {
  if (requested === undefined) return undefined;
  const id = (requested ?? "").trim() || null;
  const refusal = assignRefusal(auth, id);
  if (refusal) throw APIError.permissionDenied(refusal);
  if (!id) return null;
  const person = await db.rawQueryRow<{ left_at: Date | null; station: string | null }>(
    `SELECT u.left_at, fp.station FROM users u
     LEFT JOIN firefighter_profiles fp ON fp.user_id = u.id
     WHERE u.id = $1`,
    id
  );
  if (!person || person.left_at) throw APIError.invalidArgument("That person isn't on the station's list any more.");
  if (!atHomeStation(person.station)) throw APIError.invalidArgument("That person is recorded at another station.");
  return id;
}

/** Lets someone know a task has been given to them (not when they took it themselves). Never throws. */
export async function tellAssignee(
  task: { id: number; title: string; due_at?: Date | string | null },
  assignee: string,
  auth: AuthData
): Promise<void> {
  if (assignee === auth.userID) return;
  try {
    const by = await db.rawQueryRow<{ name: string | null }>(`SELECT name FROM users WHERE id = $1`, auth.userID);
    await createNotification({
      user_id: assignee,
      type: "task_assigned",
      title: `Task for you: ${task.title}`,
      message: assignedNote(task, by?.name ?? null),
      entity_type: "task",
      entity_id: String(task.id),
      link: `/tasks?task=${task.id}`,
    });
  } catch (err) {
    console.error("Failed to tell someone about their task:", err);
  }
}
