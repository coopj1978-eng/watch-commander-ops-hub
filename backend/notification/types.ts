export interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  due_date: Date;
  related_entity_type?: string;
  related_entity_id?: string;
  is_read: boolean;
  created_at: Date;
}

export interface ListNotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export interface MarkReadResponse {
  success: boolean;
}
