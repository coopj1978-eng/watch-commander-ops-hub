export interface CrewStats {
  total_firefighters: number;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  upcoming_inspections: number;
  overdue_one_to_ones: number;
  completion_rate: number;
}

export interface BulkTaskAssignment {
  assigned_to_ids: string[];
  title: string;
  description?: string;
  category: string;
  priority?: string;
  stagger_days: number;
  start_date: Date;
}
