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
  /** For internal attendees this is the system user id. Null when the attendee
   *  is external (from another station/watch with no account here). */
  user_id?: string;
  user_name: string;
  /** Populated when the attendee is external — optional metadata shown in the UI. */
  external_rank?: string;
  external_station?: string;
  is_external: boolean;
  competencies_covered: string[];
  notes?: string;
}

export interface ExternalAttendeeInput {
  name: string;
  rank?: string;
  /** Watch or station they came from, e.g. "Red Watch, Springburn". */
  station?: string;
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
  /** System user ids of internal attendees. Empty when only external attendees are being added. */
  user_ids: string[];
  /** External attendees from other stations/watches without an account in this system. */
  externals?: ExternalAttendeeInput[];
  competencies_covered?: string[];
  notes?: string;
}

export interface RemoveAttendanceRequest {
  id: number;
  userId: string;
}
