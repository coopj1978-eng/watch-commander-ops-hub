import { APIError } from "encore.dev/api";
import type { AuthData, UserRole } from "./auth";

export enum Permission {
  FULL_ADMIN = "full_admin",
  MANAGE_ALL_USERS = "manage_all_users",
  MANAGE_ALL_TASKS = "manage_all_tasks",
  MANAGE_ALL_INSPECTIONS = "manage_all_inspections",
  VIEW_ALL_PROFILES = "view_all_profiles",
  EDIT_ALL_PROFILES = "edit_all_profiles",
  VIEW_OWN_PROFILE = "view_own_profile",
  EDIT_OWN_PROFILE = "edit_own_profile",
  CREATE_POLICIES = "create_policies",
  VIEW_POLICIES = "view_policies",
  EXPORT_REPORTS = "export_reports",
  VIEW_ACTIVITY_LOG = "view_activity_log",
  MANAGE_ASSIGNED_CREWS = "manage_assigned_crews",
  EDIT_ASSIGNED_FIREFIGHTERS = "edit_assigned_firefighters",
  MANAGE_SYSTEM_SETTINGS = "manage_system_settings",
}

const rolePermissions: Record<UserRole, Permission[]> = {
  WC: [
    Permission.FULL_ADMIN,
    Permission.MANAGE_ALL_USERS,
    Permission.MANAGE_ALL_TASKS,
    Permission.MANAGE_ALL_INSPECTIONS,
    Permission.VIEW_ALL_PROFILES,
    Permission.EDIT_ALL_PROFILES,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.CREATE_POLICIES,
    Permission.VIEW_POLICIES,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_ACTIVITY_LOG,
    Permission.MANAGE_SYSTEM_SETTINGS,
  ],
  CC: [
    Permission.MANAGE_ASSIGNED_CREWS,
    Permission.MANAGE_ALL_TASKS,
    Permission.MANAGE_ALL_INSPECTIONS,
    Permission.VIEW_ALL_PROFILES,
    Permission.EDIT_ASSIGNED_FIREFIGHTERS,
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.VIEW_POLICIES,
    Permission.EXPORT_REPORTS,
  ],
  FF: [
    Permission.VIEW_OWN_PROFILE,
    Permission.EDIT_OWN_PROFILE,
    Permission.VIEW_POLICIES,
  ],
  RO: [
    Permission.VIEW_ALL_PROFILES,
    Permission.VIEW_POLICIES,
    Permission.EXPORT_REPORTS,
  ],
};

export function hasPermission(
  auth: AuthData,
  permission: Permission
): boolean {
  const permissions = rolePermissions[auth.role] || [];
  return permissions.includes(permission);
}

export function requirePermission(
  auth: AuthData,
  permission: Permission
): void {
  if (!hasPermission(auth, permission)) {
    throw APIError.permissionDenied(
      `Role ${auth.role} does not have permission: ${permission}`
    );
  }
}

export function requireRole(auth: AuthData, ...roles: UserRole[]): void {
  if (!roles.includes(auth.role)) {
    throw APIError.permissionDenied(
      `Access denied. Required roles: ${roles.join(", ")}`
    );
  }
}

export function canManageUser(auth: AuthData, targetUserId: string): boolean {
  if (auth.userID === targetUserId) {
    return hasPermission(auth, Permission.EDIT_OWN_PROFILE);
  }

  if (hasPermission(auth, Permission.FULL_ADMIN)) {
    return true;
  }

  return false;
}

export function canManageTask(
  auth: AuthData,
  taskAssignedTo?: string
): boolean {
  if (hasPermission(auth, Permission.FULL_ADMIN)) {
    return true;
  }

  if (
    hasPermission(auth, Permission.MANAGE_ALL_TASKS) &&
    auth.role === "CC"
  ) {
    return true;
  }

  return false;
}

export function canViewPeople(auth: AuthData): boolean {
  return ["WC", "CC", "RO"].includes(auth.role);
}

export function canCreatePerson(auth: AuthData): boolean {
  return ["WC", "CC"].includes(auth.role);
}

export function canEditPerson(
  auth: AuthData,
  profileUserId: string,
  field?: string
): boolean {
  if (auth.userID === profileUserId) {
    return hasPermission(auth, Permission.EDIT_OWN_PROFILE);
  }

  if (auth.role === "WC") {
    return true;
  }

  if (auth.role === "CC") {
    const restrictedFields = [
      "role",
      "rank",
      "service_number",
      "watch_unit",
    ];
    if (field && restrictedFields.includes(field)) {
      return false;
    }
    const allowedFields = [
      "station",
      "phone",
      "email",
      "emergency_contact_name",
      "emergency_contact_phone",
      "skills",
      "certifications",
      "notes",
      "last_one_to_one_date",
      "next_one_to_one_date",
      "driver",
      "prps",
      "ba",
    ];
    return !field || allowedFields.includes(field);
  }

  return false;
}

export function canEditProfile(
  auth: AuthData,
  profileUserId: string,
  field?: string
): boolean {
  return canEditPerson(auth, profileUserId, field);
}

export function canViewProfile(
  auth: AuthData,
  profileUserId: string
): boolean {
  if (auth.userID === profileUserId) {
    return true;
  }

  return hasPermission(auth, Permission.VIEW_ALL_PROFILES);
}

export function canEditProfiles(auth: AuthData): boolean {
  return auth.role === "WC" || auth.role === "CC";
}

export function filterByRole<T extends { assigned_to_user_id?: string | null }>(
  auth: AuthData,
  items: T[]
): T[] {
  if (hasPermission(auth, Permission.FULL_ADMIN)) {
    return items;
  }

  if (auth.role === "CC") {
    return items;
  }

  if (auth.role === "FF") {
    return items.filter((item) => item.assigned_to_user_id === auth.userID);
  }

  return items;
}
