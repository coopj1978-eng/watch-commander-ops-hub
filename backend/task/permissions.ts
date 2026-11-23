import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { slotAt, watchForSlot } from "../lib/shiftRota";

interface TaskOwnership {
  assigned_by: string | null;
  assigned_to_user_id: string | null;
  watch_unit: string | null;
  /** The watch of the person it's given to — it shows on their watch's board too. */
  assignee_watch: string | null;
}

/**
 * Full edit / delete: the creator, the assignee, or a WC/CC on the task's watch.
 * `boardMoveOnly`: any member of the task's watch — or anyone, while that
 * watch is on duty — may move a card or tick checklist items, since everyone
 * working the shift works the shared board. Returns which of the two applied:
 * "board" means ticks and moves only, never the card's wording.
 */
export async function assertCanModifyTask(taskId: number, boardMoveOnly = false): Promise<"full" | "board"> {
  const auth = getAuthData()!;
  const task = await db.queryRow<TaskOwnership>`
    SELECT t.assigned_by, t.assigned_to_user_id, t.watch_unit, au.watch_unit AS assignee_watch
    FROM tasks t LEFT JOIN users au ON au.id = t.assigned_to_user_id
    WHERE t.id = ${taskId}
  `;
  if (!task) throw APIError.notFound("task not found");

  // A task given to someone on another watch is on their watch's board as
  // well, so that watch works it like its own (John, Nov 2026).
  const watches = [task.watch_unit, task.assignee_watch]
    .filter((w): w is string => !!w)
    .map((w) => w.toLowerCase());
  const mine = (auth.watchUnit ?? "").toLowerCase();
  const sameWatch = !task.watch_unit || (!!mine && watches.includes(mine));
  const isManager = auth.role === "WC" || auth.role === "CC";
  const isOwner = task.assigned_by === auth.userID || task.assigned_to_user_id === auth.userID;

  if (isOwner) return "full";
  // An admin can change any card, on any watch (John, 18 Nov 2026).
  if (auth.isAdmin) return "full";
  if (isManager && sameWatch) return "full";
  // Working the board (moving a card, ticking its checklist) is for the
  // watch's own members — and for anyone working the shift on duty now
  // (head-for-heads, overtime), who see that watch's board.
  const onDutyNow =
    !!task.watch_unit && watches.includes((watchForSlot(slotAt(new Date()))?.watch ?? "").toLowerCase());
  if (boardMoveOnly && (sameWatch || onDutyNow) && auth.role !== "RO") return "board";

  throw APIError.permissionDenied("You don't have permission to change this task");
}
