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
