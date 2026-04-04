export type ShiftType = "Day" | "Night";

export interface Handover {
  id: number;
  watch: string;
  shift_type: ShiftType;
  shift_date: string;
  written_by_user_id: string;
  written_by_name?: string;
  incidents?: string;
  outstanding_tasks?: string;
  equipment_notes?: string;
  staff_notes?: string;
  general_notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateHandoverRequest {
  watch: string;
  shift_type: ShiftType;
  shift_date: string;
  incidents?: string;
  outstanding_tasks?: string;
  equipment_notes?: string;
  staff_notes?: string;
  general_notes?: string;
}

export interface UpdateHandoverRequest {
  id: number;
  incidents?: string;
  outstanding_tasks?: string;
  equipment_notes?: string;
  staff_notes?: string;
  general_notes?: string;
}

export interface ListHandoversRequest {
  watch?: string;
  limit?: number;
  offset?: number;
}

export interface ListHandoversResponse {
  handovers: Handover[];
  total: number;
}

export interface GetLatestHandoverRequest {
  watch?: string;
}
