export type TargetMetric = "HFSV" | "HighRise" | "Hydrants" | "Activities";
export type TargetStatus = "active" | "completed" | "at_risk" | "overdue";

export interface Target {
  id: number;
  period_start: Date;
  period_end: Date;
  metric: TargetMetric;
  target_count: number;
  actual_count: number;
  notes?: string;
  status: TargetStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTargetRequest {
  period_start: Date;
  period_end: Date;
  metric: TargetMetric;
  target_count: number;
  actual_count?: number;
  notes?: string;
  status?: TargetStatus;
}

export interface UpdateTargetRequest {
  period_start?: Date;
  period_end?: Date;
  metric?: TargetMetric;
  target_count?: number;
  actual_count?: number;
  notes?: string;
  status?: TargetStatus;
}
