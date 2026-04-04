export type ShiftAdjustmentType = "flexi" | "training" | "h4h" | "flexi_payback" | "orange_day";

export interface ShiftAdjustment {
  id: number;
  user_id: string;
  user_name?: string;
  type: ShiftAdjustmentType;
  start_date: Date;
  end_date: Date;
  covering_user_id?: string;
  covering_name?: string;
  covering_watch?: string;    // for flexi_payback / orange_day: the watch being covered
  shift_day_night?: "Day" | "Night"; // for flexi_payback / orange_day
  watch_unit: string;
  notes?: string;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}
