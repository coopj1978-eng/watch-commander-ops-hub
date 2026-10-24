import { APIError } from "encore.dev/api";
import type { AuthData } from "./auth";

/**
 * User management — adding and removing people, invites, password reset
 * links, imports, changing someone's role or email — is for the admin
 * (users.is_admin) only, not every WC.
 */
export function requireAdmin(auth: AuthData): void {
  if (!auth.isAdmin) {
    throw APIError.permissionDenied("Only the admin can manage user accounts.");
  }
}
