export type InspectionType = "HighRise" | "LocalProperty" | "Hydrant" | "Other";
export type InspectionStatus = "Planned" | "InProgress" | "Complete";
export type InspectionPriority = "Low" | "Med" | "High";

export interface Inspection {
  id: number;
  type: InspectionType;
  address: string;
  priority: InspectionPriority;
  scheduled_for: Date;
  assigned_crew_ids?: string[];
  status: InspectionStatus;
  notes?: string;
  completed_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateInspectionRequest {
  title: string;
  location: string;
  inspection_type: string;
  scheduled_date: Date;
  inspector_id?: string;
  priority?: InspectionPriority;
  next_inspection_date?: Date;
}

export interface UpdateInspectionRequest {
  type?: InspectionType;
  address?: string;
  priority?: InspectionPriority;
  scheduled_for?: Date;
  assigned_crew_ids?: string[];
  status?: InspectionStatus;
  notes?: string;
  completed_date?: Date;
}
