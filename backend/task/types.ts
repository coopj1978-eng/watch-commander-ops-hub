export type TaskStatus = "NotStarted" | "InProgress" | "Blocked" | "Done";
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
  status: TaskStatus;
  priority: TaskPriority;
  due_at?: Date;
  checklist?: ChecklistItem[];
  attachments?: string[];
  rrule?: string;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  category: TaskCategory;
  assigned_to?: string;
  assigned_by: string;
  priority?: TaskPriority;
  due_date?: Date;
  checklist?: ChecklistItem[];
  attachments?: string[];
  rrule?: string;
  tags?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  category?: TaskCategory;
  assigned_to?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: Date;
  checklist?: ChecklistItem[];
  attachments?: string[];
  rrule?: string;
  tags?: string[];
}
