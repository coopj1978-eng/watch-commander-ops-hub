import { Query } from "encore.dev/api";

export type Appliance  = "b10p1" | "b10p2" | "detached";
export type CrewRole   = "oic" | "driver" | "ba" | "baeco" | "ff" | "detached";
export type ShiftType  = "1st Day" | "2nd Day" | "1st Night" | "2nd Night";

export interface CrewingEntry {
  id: number;
  watch: string;
  shift_date: string;
  shift_type: ShiftType;
  appliance: Appliance;
  user_id?: string;
  user_name?: string;
  user_system_role?: string; // WC | CC | FF
  user_rank?: string;
  external_name?: string;
  crew_role: CrewRole;
  is_change_of_shift: boolean;
  notes?: string;
  created_at: string;
}

export interface ListCrewingRequest {
  watch: Query<string>;
  shift_date: Query<string>;
  shift_type: Query<ShiftType>;
}

export interface ListCrewingResponse {
  entries: CrewingEntry[];
}

export interface AddCrewingRequest {
  watch: string;
  shift_date: string;
  shift_type: ShiftType;
  appliance: Appliance;
  user_id?: string;
  external_name?: string;
  crew_role: CrewRole;
  is_change_of_shift?: boolean;
  notes?: string;
}

export interface CopyPreviousRequest {
  watch: string;
  shift_date: string;
  shift_type: ShiftType;
}

// ── Roster ────────────────────────────────────────────────────────────────────

export interface RosterMember {
  id: string;
  name: string;
  system_role: string; // WC | CC | FF
  rank?: string;
  watch_unit?: string;
  profile_watch?: string;
  ba: boolean;
  prps: boolean;
  driver_lgv: boolean;
  driver_erd: boolean;
}

export interface RosterRequest {
  watch: Query<string>;
}

export interface RosterResponse {
  members: RosterMember[];
}
