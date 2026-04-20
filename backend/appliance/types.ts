export type ApplianceType = "Rescue" | "Decon" | "Aerial" | "Special" | "Other";

export type EquipmentCategory = "BA" | "Ladders" | "Hose" | "TIC" | "PPE" | "Tools" | "Medical" | "Other";

export type CheckStatus = "InProgress" | "Complete";

export type CheckItemStatus = "OK" | "Defective" | "Missing";

export type WatchType = "Day" | "Night";

export type DefectStatus = "Open" | "Ordered" | "Resolved";

export type DefectType = "equipment" | "appliance" | "station";

export interface Appliance {
  id: number;
  call_sign: string;
  name: string;
  type: ApplianceType;
  station_call_sign: string;
  station_name: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EquipmentItem {
  id: number;
  appliance_id: number;
  name: string;
  category: EquipmentCategory;
  serial_number: string | null;
  quantity: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EquipmentCheck {
  id: number;
  appliance_id: number;
  checked_by: string;
  watch: WatchType;
  status: CheckStatus;
  notes: string | null;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
}

export interface EquipmentCheckItem {
  id: number;
  check_id: number;
  equipment_item_id: number;
  status: CheckItemStatus;
  quantity_checked: number;
  notes: string | null;
  created_at: Date;
}

export interface EquipmentDefect {
  id: number;
  check_item_id: number | null;
  equipment_item_id: number | null;
  appliance_id: number | null;
  defect_type: DefectType;
  title: string | null;
  location: string | null;
  reported_by: string;
  description: string;
  status: DefectStatus;
  reported_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReportDefectRequest {
  defect_type: DefectType;
  appliance_id?: number;          // required when type is 'equipment' or 'appliance'
  equipment_item_id?: number;     // required when type is 'equipment'
  location?: string;              // used when type is 'station'
  title: string;                  // short summary
  description: string;            // full detail
}

// Request/Response types

export interface CreateApplianceRequest {
  call_sign: string;
  name: string;
  type: ApplianceType;
  station_call_sign: string;
  station_name: string;
}

export interface UpdateApplianceRequest {
  id: number;
  call_sign?: string;
  name?: string;
  type?: ApplianceType;
  active?: boolean;
}

export interface CreateEquipmentRequest {
  appliance_id: number;
  name: string;
  category: EquipmentCategory;
  serial_number?: string;
  quantity?: number;
}

export interface UpdateEquipmentRequest {
  id: number;
  name?: string;
  category?: EquipmentCategory;
  serial_number?: string;
  quantity?: number;
  active?: boolean;
}

export interface StartCheckRequest {
  appliance_id: number;
  watch: WatchType;
  items: CheckItemInput[];
  notes?: string;
}

export interface CheckItemInput {
  equipment_item_id: number;
  status: CheckItemStatus;
  quantity_checked: number;
  notes?: string;
}

export interface CompleteCheckRequest {
  id: number;
  items: CheckItemInput[];
  notes?: string;
}

export interface UpdateDefectRequest {
  id: number;
  status?: DefectStatus;
  description?: string;
}

export interface ListAppliancesResponse {
  appliances: Appliance[];
}

export interface ListEquipmentResponse {
  items: EquipmentItem[];
}

export interface ListChecksResponse {
  checks: EquipmentCheck[];
  total: number;
}

export interface CheckDetailResponse {
  check: EquipmentCheck;
  items: (EquipmentCheckItem & { equipment_name: string; equipment_category: string; equipment_serial: string | null })[];
  checked_by_name: string;
}

export interface ListDefectsResponse {
  // equipment_name / appliance_call_sign are empty strings when the defect
  // isn't tied to a specific item or appliance (appliance-level and station-
  // level defects respectively). Kept as string for API-shape stability.
  defects: (EquipmentDefect & { equipment_name: string; appliance_call_sign: string; reported_by_name: string; overdue: boolean })[];
}
