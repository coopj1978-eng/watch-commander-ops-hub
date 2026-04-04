export type TaskStatus = "NotStarted" | "InProgress" | "Blocked" | "Done" | string;
export type TaskPriority = "Low" | "Med" | "High";
export type TaskCategory = "Training" | "Inspection" | "HFSV" | "Admin" | "Other";

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  category: TaskCategory;
  assigned_to_user_id?: string;
  watch_unit?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at?: Date;
  checklist?: ChecklistItem[];
  attachments?: string[];
  tags?: string[];
  rrule?: string;
  position?: number;
  completed_at?: Date;
  cover_colour?: string;
  source_type?: string;
  source_id?: number;
  calendar_event_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface TaskColumn {
  id: number;
  name: string;
  status_key: string;
  color: string;
  position: number;
  created_at: Date;
}

export interface TaskTemplate {
  id: number;
  name: string;
  description?: string;
  title_template: string;
  task_description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  checklist?: ChecklistItem[];
  rrule: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  category: TaskCategory;
  assigned_to?: string;
  assigned_by: string;
  watch_unit?: string;
  priority?: TaskPriority;
  due_date?: Date;
  checklist?: ChecklistItem[];
  attachments?: string[];
  rrule?: string;
  tags?: string[];
  position?: number;
  status?: TaskStatus;
  source_type?: string;
  source_id?: number;
  calendar_event_id?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  category?: TaskCategory;
  assigned_to?: string;
  watch_unit?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: Date;
  checklist?: ChecklistItem[];
  attachments?: string[];
  rrule?: string;
  tags?: string[];
  cover_colour?: string;
  position?: number;
}
