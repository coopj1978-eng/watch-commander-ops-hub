import { Query } from "encore.dev/api";

export type ActivityType = "hfsv" | "hydrant" | "community";

export interface ActivityRecord {
  id: number;
  type: ActivityType;
  watch: string;
  financial_year: number;
  quarter: number;
  item_number: number | null;
  title: string;
  address: string | null;
  engagement_date: Date | null;
  details: string | null;
  completed: boolean;
  completed_at: Date | null;
  scheduled: boolean;
  sort_order: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// ── Requests ────────────────────────────────────────────────────────────────

export interface ListActivitiesRequest {
  type?: Query<ActivityType>;
  watch?: Query<string>;
  financial_year?: Query<number>;
  quarter?: Query<number>;
}

export interface ListActivitiesResponse {
  items: ActivityRecord[];
  total_completed: number;
  total: number;
}

export interface CreateActivityRequest {
  type: ActivityType;
  watch: string;
  financial_year: number;
  quarter: number;
  item_number?: number;
  title?: string;
  address?: string;
  engagement_date?: string;
  details?: string;
}

export interface UpdateActivityRequest {
  title?: string;
  address?: string;
  engagement_date?: string;
  details?: string;
}

export interface ToggleActivityResponse {
  item: ActivityRecord;
}

// Seed 36 blank HFSV placeholders for a watch/year/quarter.
export interface SeedHfsvRequest {
  watch: string;
  financial_year: number;
  quarter: number;
}

export interface SeedHfsvResponse {
  created: number;
  skipped: number;
}
