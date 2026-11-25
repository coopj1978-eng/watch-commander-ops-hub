import db from "../db";
import { createNotification } from "../notification/helpers";
import type { Task } from "./types";

/**
 * Tell the person a task has been given to (John, 25 Nov 2026: "I need to be
 * able to assign a task to someone on the system"). One notification, with
 * who gave it and when it's due. Nobody is told about a task they gave
 * themselves, and a failure here never stops the task being saved.
 */
export async function tellAssignee(task: Task, byUserId: string): Promise<void> {
  const to = task.assigned_to_user_id;
  if (!to || to === byUserId) return;
  try {
    const by = await db.queryRow<{ name: string | null }>`SELECT name FROM users WHERE id = ${byUserId}`;
    const due = task.due_at
      ? ` Due ${new Date(task.due_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}.`
      : "";
    await createNotification({
      user_id: to,
      type: "general",
      title: `Task for you: ${task.title}`,
      message: `${by?.name ?? "Someone"} gave you this task.${due}`,
      entity_type: "task",
      entity_id: String(task.id),
      link: "/tasks",
    });
  } catch (err) {
    console.error("Failed to tell the assignee about a task:", err);
  }
}
