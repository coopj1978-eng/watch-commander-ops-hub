export interface H4HEntry {
  id: number;
  creditor_user_id: string;
  creditor_name: string;
  debtor_user_id: string;
  debtor_name: string;
  shift_date: string;
  shift_adjustment_id: number | null;
  payback_shift_adjustment_id: number | null;
  status: "pending" | "settled";
  settled_at: string | null;
  settled_by_user_id: string | null;
  settled_via: "auto" | "manual" | null;
  notes: string | null;
  created_at: string;
}

export interface ListH4HRequest {
  user_id: string;
  status?: "pending" | "settled";
}

export interface ListH4HResponse {
  owed_to_me: H4HEntry[];   // I am the creditor — others owe me
  i_owe: H4HEntry[];         // I am the debtor — I owe others
}

export interface SettleH4HRequest {
  id: number;
}
