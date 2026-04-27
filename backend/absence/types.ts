export type AbsenceType = "sickness" | "AL" | "TOIL" | "parental" | "other";
export type AbsenceStatus = "pending" | "approved" | "rejected";

export interface Absence {
  id: number;
  firefighter_id: string;
  type: AbsenceType;
  start_date: Date;
  end_date: Date;
  total_days?: number;
  reason: string;
  docs?: string[];
  evidence_urls?: string[];
  sick_line_document?: string; // base64 image or URL of uploaded sick line
  status: AbsenceStatus;
  approved_by?: string;
  approved_at?: Date;
  /** Timestamp when the FF was explicitly booked back fit. NULL means
   *  the sickness is still open and the FF is currently off, regardless
   *  of whether the original end_date has passed. */
  returned_to_work_at?: Date | null;
  created_by_user_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAbsenceRequest {
  user_id: string;
  type: AbsenceType;
  start_date: Date;
  end_date: Date;
  reason: string;
  evidence_urls?: string[];
}

export interface UpdateAbsenceRequest {
  start_date?: Date;
  end_date?: Date;
  reason?: string;
  type?: AbsenceType;
  status?: AbsenceStatus;
  evidence_urls?: string[];
}

export interface AbsenceStats {
  user_id: string;
  total_days: number;
  sick_days: number;
  vacation_days: number;
  other_days: number;
  six_month_total: number;
  stage_alert?: string;
}
