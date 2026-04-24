export interface PolicyDoc {
  id: number;
  title: string;
  category?: string;
  version?: string;
  file_url?: string;
  vector_id?: string;
  uploaded_at: Date;
  review_date?: Date;
  file_name: string;
  file_path: string;
  file_size: number;
  tags?: string[];
  effective_date?: Date;
  uploaded_by: string;
  total_pages?: number;
  created_at: Date;
  updated_at: Date;
  /** When true, every active WC/CC/FF must formally acknowledge the
   *  current version of the policy. Flipped on explicitly by an author
   *  / WC — defaults false so reference material isn't noisy. */
  requires_ack: boolean;
  /** Per-caller fields populated by list + getStats endpoints. */
  is_acknowledged?: boolean;
  audience_count?: number;
  acknowledged_count?: number;
}

export interface PolicyAckStats {
  user_id: string;
  name: string;
  rank?: string;
  watch_unit?: string;
  acknowledged_at?: string;
  /** Version the user has acknowledged — set only when they've acked
   *  *a* version; if it differs from the current policy version they
   *  need to ack again. */
  acknowledged_version?: string;
}

export interface GetPolicyStatsResponse {
  policy: PolicyDoc;
  audience: PolicyAckStats[];
}

export interface Citation {
  doc_title: string;
  page: number;
}

export interface PolicyQuery {
  id: number;
  asked_by_user_id: string;
  question: string;
  answer: string;
  citations: Citation[];
  confidence?: number;
  created_at: Date;
}

export interface CreatePolicyDocRequest {
  title: string;
  file_name: string;
  file_path: string;
  file_size: number;
  category?: string;
  tags?: string[];
  version?: string;
  effective_date?: Date;
  uploaded_by: string;
  total_pages?: number;
}

export interface AskPolicyRequest {
  query: string;
}

export interface AskPolicyResponse {
  answer: string;
  citations: Citation[];
  confidence?: number;
}
