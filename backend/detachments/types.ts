import type { Query } from "encore.dev/api";

export interface Detachment {
  id: number;
  firefighter_id: string;
  firefighter_name: string;
  home_watch: string;
  to_station: string;
  detachment_date: string;
  reason?: string;
  notes?: string;
  recorded_by_user_id: string;
  created_at: string;
}

export interface CreateDetachmentRequest {
  firefighter_id: string;
  firefighter_name: string;
  home_watch: string;
  to_station: string;
  detachment_date: string;
  reason?: string;
  notes?: string;
}

export interface ListDetachmentsRequest {
  watch?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

export interface ListDetachmentsResponse {
  detachments: Detachment[];
  total: number;
}

// For the fairness rota view — one row per watch member, sorted by last detachment date
export interface RotaMember {
  firefighter_id: string;
  firefighter_name: string;
  watch_unit: string;
  last_detachment_date: string | null;
  last_to_station: string | null;
  last_reason: string | null;
  total_detachments: number;
}

export interface GetRotaRequest {
  watch: Query<string>;
}

export interface GetRotaResponse {
  members: RotaMember[];
}
