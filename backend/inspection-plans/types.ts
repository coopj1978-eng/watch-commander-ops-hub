export type WatchName = "Red" | "White" | "Green" | "Blue" | "Amber";

// ─── Multi-Story Inspections ───────────────────────────────────────────────

export interface MultistoryInspection {
  id: number;
  address: string;
  q1_watch?: WatchName;
  q2_watch?: WatchName;
  q3_watch?: WatchName;
  q4_watch?: WatchName;
  position: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMultistoryRequest {
  address: string;
  q1_watch?: WatchName;
  q2_watch?: WatchName;
  q3_watch?: WatchName;
  q4_watch?: WatchName;
}

export interface UpdateMultistoryRequest {
  address?: string;
  q1_watch?: WatchName | null;
  q2_watch?: WatchName | null;
  q3_watch?: WatchName | null;
  q4_watch?: WatchName | null;
  position?: number;
}

export interface ListMultistoryResponse {
  items: MultistoryInspection[];
}

// ─── Care Home Validations ─────────────────────────────────────────────────

export interface CareHomeValidation {
  id: number;
  address: string;
  position: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCareHomeRequest {
  address: string;
}

export interface UpdateCareHomeRequest {
  address?: string;
  position?: number;
}

export interface ListCareHomeResponse {
  items: CareHomeValidation[];
}

// ─── Hydrant Register ──────────────────────────────────────────────────────

export interface HydrantRegister {
  id: number;
  area_code: string;
  street: string;
  section: string;
  year: number;
  watch?: WatchName;
  position: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateHydrantRequest {
  area_code: string;
  street: string;
  section: string;
  year: number;
  watch?: WatchName;
}

export interface UpdateHydrantRequest {
  area_code?: string;
  street?: string;
  section?: string;
  year?: number;
  watch?: WatchName | null;
  position?: number;
}

export interface ListHydrantResponse {
  items: HydrantRegister[];
}

// ─── Operational Inspections ───────────────────────────────────────────────

export interface OperationalInspection {
  id: number;
  address: string;
  uprn: string;
  watch?: WatchName;
  position: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOperationalRequest {
  address: string;
  uprn: string;
  watch?: WatchName;
}

export interface UpdateOperationalRequest {
  address?: string;
  uprn?: string;
  watch?: WatchName | null;
  position?: number;
}

export interface ListOperationalResponse {
  items: OperationalInspection[];
}

// ─── Inspection Assignments ────────────────────────────────────────────────

export interface InspectionAssignment {
  id: number;
  plan_type: "multistory" | "care_home" | "hydrant" | "operational";
  plan_id: number;
  label: string;
  watch: WatchName;
  year: number;
  quarter: number | null;
  status: "pending" | "complete";
  completed_at: Date | null;
  completed_by: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface GenerateAssignmentsRequest {
  year: number;
  quarter?: number;
}

export interface GenerateAssignmentsResponse {
  created: number;
  skipped: number;
}

export interface ListAssignmentsRequest {
  watch?: string;
  year?: number;
  quarter?: number;
  plan_type?: string;
  status?: string;
}

export interface ListAssignmentsResponse {
  items: InspectionAssignment[];
  totals: { pending: number; complete: number };
}

export interface UpdateAssignmentRequest {
  status: "pending" | "complete";
  notes?: string;
}
