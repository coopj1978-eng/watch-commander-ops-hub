import { Query } from "encore.dev/api";

export type TrainingType =
  | "ba_drill"
  | "rtc"
  | "ladder"
  | "water"
  | "hazmat"
  | "first_aid"
  | "driver"
  | "debrief"
  | "physical"
  | "station_drill"
  | "lecture"
  | "assessment"
  | "other";

export type TrainingStatus = "planned" | "completed" | "cancelled";

export interface Attendee {
  user_id: string;
  user_name: string;
  competencies_covered: string[];
  notes?: string;
}

export interface TrainingRecord {
  id: number;
  watch: string;
  training_date: string;
  shift_type?: string;
  training_type: string;
  topic: string;
  duration_hours?: number;
  notes?: string;
  status: string;
  created_by: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  attendees?: Attendee[];
}

export interface CreateTrainingRequest {
  watch: string;
  training_date: string;
  shift_type?: string;
  training_type: string;
  topic: string;
}

export interface UpdateTrainingRequest {
  id: number;
  topic?: string;
  training_type?: string;
  training_date?: string;
  shift_type?: string;
  duration_hours?: number;
  notes?: string;
  status?: string;
}

export interface ListTrainingRequest {
  watch?: Query<string>;
  status?: Query<string>;
  start_date?: Query<string>;
  end_date?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

export interface ListTrainingResponse {
  records: TrainingRecord[];
  total: number;
}

export interface GetTrainingRequest {
  id: number;
}

export interface AddAttendanceRequest {
  id: number;
  user_ids: string[];
  competencies_covered?: string[];
  notes?: string;
}

export interface RemoveAttendanceRequest {
  id: number;
  userId: string;
}
