export type TaskStatus = "NotStarted" | "InProgress" | "Blocked" | "Done" | string;
export type TaskPriority = "Low" | "Med" | "High";
export type TaskCategory = "Training" | "Inspection" | "HFSV" | "Admin" | "Other";

export interface ChecklistItem {
  label: string;
  done: boolean;
  /** Who ticked it and when — stamped by the server, never by the client. */
  done_by?: string;
  done_by_name?: string;
  done_at?: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  category: TaskCategory;
  assigned_to_user_id?: string;
  /** Who set the task. */
  assigned_by?: string;
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
  /** Who moved it to Done. */
  completed_by?: string;
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
  /** "Every shift": a card for the day and night shift of each day the rule fires. */
  per_shift: boolean;
  /** Every-shift templates limited to the day or the night shift. */
  shift_only?: "day" | "night" | null;
  /** Weekly routine slot: 'every' or a weekday + shift, e.g. 'MO-day'. */
  routine_slot?: string | null;
  /** Which weeks a routine card comes round: 'weekly' | 'first' | 'last' | 'quarter-last'. */
  routine_rule?: string | null;
  /** Header: null = automatic (day + how often); a colour id, image URL or uploaded picture. */
  cover?: string | null;
  routine_position?: number;
  /** A reference duty card (1–5) — made by the reference rota, not shown under Other checks. */
  reference_no?: number | null;
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
