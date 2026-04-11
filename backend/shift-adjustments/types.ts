export type ShiftAdjustmentType = "flexi" | "training" | "h4h" | "flexi_payback" | "orange_day" | "toil";

export interface ShiftAdjustment {
  id: number;
  user_id: string;
  user_name?: string;
  type: ShiftAdjustmentType;
  start_date: Date;
  end_date: Date;
  covering_user_id?: string;
  covering_name?: string;
  covering_watch?: string;
  shift_day_night?: "Day" | "Night";
  toil_hours?: number;          // how many TOIL hours used for this shift
  watch_unit: string;
  notes?: string;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}
