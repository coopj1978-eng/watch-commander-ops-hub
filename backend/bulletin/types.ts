export type BulletinScope = "watch" | "station";
export type BulletinPriority = "routine" | "important" | "urgent";

export interface Bulletin {
  id: number;
  posted_by: string;
  posted_by_name?: string;
  scope: BulletinScope;
  watch_unit?: string;
  title: string;
  body: string;
  priority: BulletinPriority;
  requires_ack: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  // Per-caller fields — set when returned from list/get endpoints.
  /** True if the caller has a row in bulletin_reads. */
  is_read?: boolean;
  /** True if requires_ack AND caller has acknowledged_at set. */
  is_acknowledged?: boolean;
  // Aggregate counts — populated for the posting user / WC stats view.
  /** How many users the bulletin is visible to (denominator for progress). */
  audience_count?: number;
  /** How many of those have marked as read. */
  read_count?: number;
  /** How many of those have acknowledged (only meaningful if requires_ack). */
  acknowledged_count?: number;
}

export interface CreateBulletinRequest {
  scope: BulletinScope;
  /** Only for scope='watch' — the watch name (e.g. "White"). Ignored for 'station'. */
  watch_unit?: string;
  title: string;
  body: string;
  priority?: BulletinPriority;
  requires_ack?: boolean;
  /** ISO date string; null/undefined = never expires. */
  expires_at?: string;
}

export interface ListBulletinsRequest {
  /**
   * When true, returns every bulletin the caller is allowed to see
   * (including ones they've read and ones past their expiry). When false
   * or unset, hides acknowledged-or-past-expiry items so the FF dashboard
   * shows a clean "what's new for me" list.
   */
  include_read?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListBulletinsResponse {
  bulletins: Bulletin[];
  total: number;
  unread_count: number;
  unacked_count: number;
}

export interface BulletinReadStats {
  user_id: string;
  name: string;
  rank?: string;
  watch_unit?: string;
  read_at?: string;
  acknowledged_at?: string;
}

export interface GetBulletinStatsResponse {
  bulletin: Bulletin;
  audience: BulletinReadStats[];
}
