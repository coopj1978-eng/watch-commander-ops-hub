export interface ActivityLog {
  id: number;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

export interface CreateActivityLogRequest {
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: any;
}
