export type TriggerStage = "None" | "Stage1" | "Stage2" | "Stage3";

export type WatchUnit = "Green" | "Red" | "White" | "Blue" | "Amber";

export type DriverPathwayStatus = 
  | "medical_due" 
  | "application_sent" 
  | "awaiting_theory" 
  | "awaiting_course" 
  | "passed_LGV" 
  | "awaiting_ERD" 
  | "passed";

export interface DriverPathway {
  status: DriverPathwayStatus;
  lgvPassedDate?: string;
}

export interface LastConversation {
  date: string;
  text: string;
}

export interface DriverQualifications {
  lgv: boolean;
  erd: boolean;
}

export interface FirefighterProfile {
  id: number;
  user_id: string;
  service_number?: string;
  station?: string;
  shift?: string;
  watch?: WatchUnit;
  rank?: string;
  hire_date?: Date;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  skills?: string[];
  certifications?: string[];
  driver?: DriverQualifications;
  driverPathway?: DriverPathway;
  prps?: boolean;
  ba?: boolean;
  notes?: string;
  last_one_to_one_date?: Date;
  next_one_to_one_date?: Date;
  lastConversation?: LastConversation;
  customFields?: Record<string, string | number | boolean | null>;
  rolling_sick_episodes: number;
  rolling_sick_days: number;
  trigger_stage: TriggerStage;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProfileRequest {
  user_id: string;
  service_number?: string;
  station?: string;
  shift?: string;
  watch?: WatchUnit;
  rank?: string;
  hire_date?: Date;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  skills?: string[];
  certifications?: string[];
  driver?: DriverQualifications;
  driverPathway?: DriverPathway;
  prps?: boolean;
  ba?: boolean;
  notes?: string;
  last_one_to_one_date?: Date;
  next_one_to_one_date?: Date;
  lastConversation?: LastConversation;
  customFields?: Record<string, string | number | boolean | null>;
  rolling_sick_episodes?: number;
  rolling_sick_days?: number;
  trigger_stage?: TriggerStage;
}

export interface UpdateProfileRequest {
  service_number?: string;
  station?: string;
  shift?: string;
  watch?: WatchUnit | null;
  rank?: string;
  hire_date?: Date;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  skills?: string[];
  certifications?: string[];
  driver?: DriverQualifications;
  driverPathway?: DriverPathway;
  prps?: boolean;
  ba?: boolean;
  notes?: string;
  last_one_to_one_date?: Date;
  next_one_to_one_date?: Date;
  lastConversation?: LastConversation;
  customFields?: Record<string, string | number | boolean | null>;
  rolling_sick_episodes?: number;
  rolling_sick_days?: number;
  trigger_stage?: TriggerStage;
}
