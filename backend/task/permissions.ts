import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

interface TaskOwnership {
  assigned_by: string | null;
  assigned_to_user_id: string | null;
  watch_unit: string | null;
}

/**
 * Full edit / delete: the creator, the assignee, or a WC/CC on the task's watch.
 * `boardMoveOnly`: any member of the task's watch may move a card or tick
 * checklist items, since the whole watch works the shared board.
 */
export async function assertCanModifyTask(taskId: number, boardMoveOnly = false): Promise<void> {
  const auth = getAuthData()!;
  const task = await db.queryRow<TaskOwnership>`
    SELECT assigned_by, assigned_to_user_id, watch_unit FROM tasks WHERE id = ${taskId}
  `;
  if (!task) throw APIError.notFound("task not found");

  const sameWatch =
    !task.watch_unit ||
    (auth.watchUnit ?? "").toLowerCase() === task.watch_unit.toLowerCase();
  const isManager = auth.role === "WC" || auth.role === "CC";
  const isOwner = task.assigned_by === auth.userID || task.assigned_to_user_id === auth.userID;

  if (isOwner) return;
  if (isManager && sameWatch) return;
  if (boardMoveOnly && sameWatch && auth.role !== "RO") return;

  throw APIError.permissionDenied("You don't have permission to change this task");
}
