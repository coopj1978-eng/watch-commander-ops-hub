export type EventType = "watch" | "personal" | "training" | "meeting" | "inspection" | "maintenance" | "reminder";

export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  event_type: EventType;
  start_time: Date;
  end_time: Date;
  all_day: boolean;
  user_id?: string;
  is_watch_event: boolean;
  location?: string;
  attendees?: string[];
  color?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  event_type: EventType;
  start_time: Date;
  end_time: Date;
  all_day?: boolean;
  user_id?: string;
  is_watch_event?: boolean;
  location?: string;
  attendees?: string[];
  color?: string;
  created_by: string;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  event_type?: EventType;
  start_time?: Date;
  end_time?: Date;
  all_day?: boolean;
  location?: string;
  attendees?: string[];
  color?: string;
}
