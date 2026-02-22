export type AbsenceType = "sickness" | "AL" | "TOIL" | "parental" | "other";
export type AbsenceStatus = "pending" | "approved" | "rejected";

export interface Absence {
  id: number;
  firefighter_id: string;
  absence_type: AbsenceType;
  start_date: Date;
  end_date: Date;
  total_days: number;
  reason: string;
  evidence_urls?: string[];
  status: AbsenceStatus;
  approved_by?: string;
  approved_at?: Date;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAbsenceRequest {
  user_id: string;
  absence_type: AbsenceType;
  start_date: Date;
  end_date: Date;
  reason: string;
  evidence_urls?: string[];
}

export interface UpdateAbsenceRequest {
  start_date?: Date;
  end_date?: Date;
  reason?: string;
  absence_type?: AbsenceType;
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
