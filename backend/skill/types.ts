export type SkillStatus = "valid" | "warning" | "expired";

export interface SkillRenewal {
  id: number;
  profile_id: number;
  skill_name: string;
  acquired_date?: Date;
  renewal_date?: Date;
  expiry_date?: Date;
  reminder_date?: Date;
  notes?: string;
  status?: SkillStatus;
  days_until_expiry?: number;
  days_until_reminder?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSkillRenewalRequest {
  profile_id: number;
  skill_name: string;
  acquired_date?: string;
  renewal_date?: string;
  expiry_date?: string;
  reminder_date?: string;
  notes?: string;
}

export interface UpdateSkillRenewalRequest {
  skill_name?: string;
  acquired_date?: string;
  renewal_date?: string;
  expiry_date?: string;
  reminder_date?: string;
  notes?: string;
}

export interface ListSkillRenewalsResponse {
  skills: SkillRenewal[];
}
