export interface SystemSettings {
  id: number;
  skills_dictionary: string[];
  certifications_dictionary: string[];
  absence_threshold_days: number;
  absence_threshold_period_months: number;
  trigger_stage1_episodes: number;
  trigger_stage1_days: number;
  trigger_stage2_episodes: number;
  trigger_stage2_days: number;
  trigger_stage3_episodes: number;
  trigger_stage3_days: number;
  branding_logo_url?: string;
  branding_primary_color?: string;
  branding_secondary_color?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateSkillsCertsRequest {
  skills_dictionary?: string[];
  certifications_dictionary?: string[];
}

export interface UpdateAbsenceThresholdsRequest {
  absence_threshold_days?: number;
  absence_threshold_period_months?: number;
}

export interface UpdateTriggerThresholdsRequest {
  trigger_stage1_episodes?: number;
  trigger_stage1_days?: number;
  trigger_stage2_episodes?: number;
  trigger_stage2_days?: number;
  trigger_stage3_episodes?: number;
  trigger_stage3_days?: number;
}

export interface UpdateBrandingRequest {
  branding_logo_url?: string;
  branding_primary_color?: string;
  branding_secondary_color?: string;
}
