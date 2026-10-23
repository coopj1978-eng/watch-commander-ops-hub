export type UserRole = "WC" | "CC" | "FF" | "RO";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  watch_unit?: string;
  rank?: string;
  avatar_url?: string;
  last_login_at?: Date;
  is_active: boolean;
  is_admin: boolean;
  left_at?: Date;
  password_hash?: string;
  password_reset_token?: string;
  password_reset_expires?: Date;
  created_at: Date;
  updated_at: Date;
}

/** Strip credential columns before a user row leaves the API. */
export function toPublicUser<T extends User>(user: T): T {
  const { password_hash, password_reset_token, password_reset_expires, ...rest } = user;
  return rest as T;
}

export interface CreateUserRequest {
  id: string;
  email: string;
  name: string;
  role: string;
  watch_unit?: string;
  rank?: string;
  avatar_url?: string;
  is_active?: boolean;
}

export interface UpdateUserRequest {
  email?: string;
  name?: string;
  role?: string;
  watch_unit?: string;
  rank?: string;
  avatar_url?: string;
  last_login_at?: Date;
  is_active?: boolean;
  left_at?: Date;
}
