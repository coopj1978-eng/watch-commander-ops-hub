export type ShiftType = "Day" | "Night";

/**
 * One line of a handover (Oct 2026):
 *  - action: something the next watch must do — becomes a station card on
 *    the shift board, staying for whoever is on duty until someone does it;
 *  - info: something to know — shown to the next watch until they mark the
 *    handover read, or to every watch until show_until.
 */
export interface HandoverItem {
  id?: number;
  kind: "action" | "info";
  /** incident | equipment | road | call | staff | other */
  tag?: string;
  text: string;
  /** Info only: keep showing to every watch on duty until this day (YYYY-MM-DD). */
  show_until?: string;
  /** Action only: the board card, its status, and who finished it. */
  task_id?: number;
  task_status?: string;
  done_by_name?: string;
  done_at?: string;
}

export interface Handover {
  id: number;
  watch: string;
  shift_type: ShiftType;
  shift_date: string;
  written_by_user_id: string;
  written_by_name?: string;
  incidents?: string;
  outstanding_tasks?: string;
  equipment_notes?: string;
  staff_notes?: string;
  general_notes: string;
  created_at: string;
  updated_at: string;
  items: HandoverItem[];
  /** The watch on the next shift (from the rota) — who it's for. */
  next_watch?: string;
  /** When someone on next_watch marked it read. */
  read_by_name?: string;
  read_at?: string;
}

export interface CreateHandoverRequest {
  watch: string;
  shift_type: ShiftType;
  shift_date: string;
  incidents?: string;
  outstanding_tasks?: string;
  equipment_notes?: string;
  staff_notes?: string;
  general_notes?: string;
  items?: HandoverItem[];
}

export interface UpdateHandoverRequest {
  id: number;
  /** The full list — items left out are removed (and their open cards). */
  items?: HandoverItem[];
  incidents?: string;
  outstanding_tasks?: string;
  equipment_notes?: string;
  staff_notes?: string;
  general_notes?: string;
}

export interface ListHandoversRequest {
  watch?: string;
  limit?: number;
  offset?: number;
}

export interface ListHandoversResponse {
  handovers: Handover[];
  total: number;
}

export interface GetLatestHandoverRequest {
  watch?: string;
}
