export type NotificationType =
  | "sick_booking"
  | "cert_expiry"
  | "task_overdue"
  | "crewing_gap"
  | "general";

export interface Notification {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export interface ListNotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}
