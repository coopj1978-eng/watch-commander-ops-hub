export interface ActivityLog {
  id: number;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  timestamp: Date;
  metadata?: any;
}

export interface CreateActivityLogRequest {
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: any;
}
