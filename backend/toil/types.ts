import { Query } from "encore.dev/api";

export interface ToilEntry {
  id: number;
  user_id: string;
  user_name?: string;
  type: "earned" | "spent";
  hours: number;
  status: "pending" | "approved" | "rejected";
  approved_by_user_id?: string;
  approved_by_name?: string;
  approved_at?: Date;
  reason?: string;
  job_number?: string;
  shift_adjustment_id?: number;
  incident_date?: Date;
  financial_year: number;
  watch_unit: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ToilBalance {
  user_id: string;
  user_name: string;
  year: number;              // calendar year the totals below cover
  total_earned: number;      // approved hours earned this year (resets 1 Jan)
  total_spent: number;       // hours used on shifts this year (resets 1 Jan)
  pending_earned: number;    // hours awaiting approval
  balance: number;           // all-time earned - spent: carried over until used
}

export interface EarnToilRequest {
  hours: number;
  reason: string;
  job_number?: string;        // incident/job reference number
  incident_date: string;
  for_user_id?: string;      // WC/CC can log for another user
}

export interface ListToilRequest {
  user_id?: Query<string>;
  watch_unit?: Query<string>;
  financial_year?: Query<number>;
  status?: Query<string>;
  type?: Query<string>;
}

export interface ListToilResponse {
  entries: ToilEntry[];
}

export interface ToilBalanceRequest {
  user_id?: Query<string>;
  watch_unit?: Query<string>;
  /** Calendar year for the earned/used totals; defaults to this year. */
  year?: Query<number>;
}

export interface ToilBalanceResponse {
  balances: ToilBalance[];
}

export interface ApproveToilRequest {
  id: number;
  action: "approved" | "rejected";
}
