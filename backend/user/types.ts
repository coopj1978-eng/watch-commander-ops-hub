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
