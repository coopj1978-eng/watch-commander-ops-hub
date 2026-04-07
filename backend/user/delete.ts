import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import { requirePermission, Permission } from "../auth/rbac";

interface DeleteUserRequest {
  id: string;
}

export const deleteUser = api<DeleteUserRequest, void>(
  { auth: true, expose: true, method: "DELETE", path: "/users/:id" },
  async ({ id }) => {
    const auth = getAuthData()!;
    requirePermission(auth, Permission.MANAGE_ALL_USERS);

    // Prevent deleting yourself
    if (id === auth.userID) {
      throw APIError.invalidArgument("You cannot delete your own account");
    }

    // Look up user name/email for audit log before deleting
    const user = await db.queryRow<{ name: string; email: string }>`
      SELECT name, email FROM users WHERE id = ${id}
    `;
    if (!user) {
      throw APIError.notFound("User not found");
    }

    // Delete all related records first (foreign key dependencies)
    await db.exec`DELETE FROM activity_log WHERE user_id = ${id}`;
    await db.exec`DELETE FROM activity_records WHERE created_by = ${id}`;
    await db.exec`DELETE FROM notifications WHERE user_id = ${id}`;
    await db.exec`DELETE FROM absences WHERE firefighter_id = ${id}`;
    await db.exec`UPDATE absences SET approved_by = NULL WHERE approved_by = ${id}`;
    await db.exec`DELETE FROM shift_crewing WHERE user_id = ${id}`;
    await db.exec`UPDATE shift_crewing SET created_by = NULL WHERE created_by = ${id}`;
    await db.exec`DELETE FROM calendar_events WHERE user_id = ${id}`;
    await db.exec`UPDATE calendar_events SET created_by = NULL WHERE created_by = ${id}`;
    await db.exec`DELETE FROM notes WHERE created_by_user_id = ${id}`;
    await db.exec`UPDATE notes SET reminder_recipient_user_id = NULL WHERE reminder_recipient_user_id = ${id}`;
    await db.exec`DELETE FROM shift_adjustments WHERE user_id = ${id}`;
    await db.exec`UPDATE shift_adjustments SET covering_user_id = NULL WHERE covering_user_id = ${id}`;
    await db.exec`UPDATE shift_adjustments SET created_by_user_id = NULL WHERE created_by_user_id = ${id}`;
    await db.exec`UPDATE tasks SET assigned_to_user_id = NULL WHERE assigned_to_user_id = ${id}`;
    await db.exec`UPDATE tasks SET assigned_by = NULL WHERE assigned_by = ${id}`;
    await db.exec`UPDATE equipment_checks SET checked_by = NULL WHERE checked_by = ${id}`;
    await db.exec`UPDATE equipment_defects SET reported_by = NULL WHERE reported_by = ${id}`;
    await db.exec`UPDATE equipment_defects SET resolved_by = NULL WHERE resolved_by = ${id}`;
    await db.exec`UPDATE task_templates SET created_by = NULL WHERE created_by = ${id}`;
    await db.exec`UPDATE policy_docs SET uploaded_by = NULL WHERE uploaded_by = ${id}`;
    await db.exec`DELETE FROM policy_queries WHERE asked_by_user_id = ${id}`;
    await db.exec`DELETE FROM h4h_ledger WHERE debtor_user_id = ${id} OR creditor_user_id = ${id}`;
    await db.exec`UPDATE handovers SET written_by_user_id = NULL WHERE written_by_user_id = ${id}`;
    await db.exec`DELETE FROM firefighter_profiles WHERE user_id = ${id}`;

    // Now delete the user
    await db.exec`DELETE FROM users WHERE id = ${id}`;

    await logActivity({
      user_id: auth.userID,
      action: "delete_user",
      entity_type: "user",
      entity_id: id,
      details: { deleted_name: user.name, deleted_email: user.email },
    });
  }
);
