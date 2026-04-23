export interface CrewStats {
  /** Number of active FFs on the caller's watch (excludes WC + CC). */
  total_firefighters: number;
  /**
   * Every active watch member — WC, CC, and FFs — on the caller's watch.
   * Used by the dashboard "Staffing Today" tile to show a true headcount
   * rather than the FF-only number. Matches the population you'd expect
   * to see on the Crewing board.
   */
  total_watch_members: number;
  /**
   * User IDs of every active watch member. Dashboard widgets use this to
   * filter "today's absences" / "sick today" queries down to this watch
   * without needing a second round-trip to /profiles. Replaces the old
   * pattern of pulling firefighter_profiles and building a user-id set
   * from that — which silently dropped any user without a profile row.
   */
  watch_member_ids: string[];
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
