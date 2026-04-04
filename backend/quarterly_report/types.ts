export type WatchName = "Blue" | "Red" | "Green" | "Amber" | "White";
export type ReportStatus = "draft" | "submitted";

export interface QuarterlyReportItem {
  id: number;
  report_id: number;
  kpi_code: string;
  description: string;
  target_text: string;
  row_color: string;
  category: string;
  sort_order: number;
  met: boolean;
  actual_value?: string;
  rationale?: string;
  created_at: string;
  updated_at: string;
}

export interface QuarterlyReportCustomItem {
  id: number;
  report_id: number;
  description: string;
  target_text?: string;
  met: boolean;
  rationale?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuarterlyReport {
  id: number;
  station_name: string;
  watch: string;
  watch_commander_name: string;
  quarter: number;
  financial_year: number;
  notes?: string;
  status: ReportStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  items: QuarterlyReportItem[];
  custom_items: QuarterlyReportCustomItem[];
}

export interface QuarterlyReportSummary {
  id: number;
  station_name: string;
  watch: string;
  watch_commander_name: string;
  quarter: number;
  financial_year: number;
  status: ReportStatus;
  items_total: number;
  items_met: number;
  created_at: string;
  updated_at: string;
}

// Standard KPI template — seeded on every new report
export const KPI_TEMPLATE = [
  {
    kpi_code: "OPS 1",
    description: "Completion of IRS reports within 14 Days (Max.)",
    target_text: "Full Compliance",
    row_color: "8EAADB",
    category: "Operational",
    sort_order: 1,
  },
  {
    kpi_code: "PMF 6",
    description: "Number of HFSVs Conducted",
    target_text: "36",
    row_color: "F7CAAC",
    category: "CS Engagement",
    sort_order: 2,
  },
  {
    kpi_code: "PMF 18",
    description: "Operational Intelligence (OI) Inspections (Revalidations / New OI)",
    target_text: "7 (90% Valid)",
    row_color: "C5E0B3",
    category: "Preparedness",
    sort_order: 3,
  },
  {
    kpi_code: "PPP 11",
    description: "New OI Record Complete (OI / Height IRP / Water IRP)",
    target_text: "1",
    row_color: "C5E0B3",
    category: "Preparedness",
    sort_order: 4,
  },
  {
    kpi_code: "PMF 20",
    description: "Hydrant Routes Carried Out",
    target_text: "Set by SC",
    row_color: "C5E0B3",
    category: "Preparedness",
    sort_order: 5,
  },
  {
    kpi_code: "PMF 22",
    description: "Completion of Operational Core Skills modules",
    target_text: "100%",
    row_color: "4472C4",
    category: "Training",
    sort_order: 6,
  },
  {
    kpi_code: "PMF 23",
    description: "Completion of any Advanced, Support and Emerging Risks Modules",
    target_text: "100%",
    row_color: "4472C4",
    category: "Training",
    sort_order: 7,
  },
  {
    kpi_code: "PMF 55",
    description: "Number of Low-Speed Manoeuvre (LSM) events",
    target_text: "0",
    row_color: "FFD966",
    category: "Safety & Assurance",
    sort_order: 8,
  },
  {
    kpi_code: "PPP 1",
    description: "PDIR conducted and recorded on CSET for every Dwelling incident",
    target_text: "Full Compliance",
    row_color: "F7CAAC",
    category: "CS Engagement",
    sort_order: 9,
  },
  {
    kpi_code: "PPP 3",
    description: "Community Safety Engagement (CSE) Activities",
    target_text: "3 (3 per TAP / 3 other)",
    row_color: "F7CAAC",
    category: "CS Engagement",
    sort_order: 10,
  },
  {
    kpi_code: "PPP 4",
    description: "Smoke / Heat Detector Stocktake (Each Shift)",
    target_text: "Full Compliance",
    row_color: "F7CAAC",
    category: "CS Engagement",
    sort_order: 11,
  },
  {
    kpi_code: "PPP 5",
    description: "Multi-Storey Inspections",
    target_text: "1/4 of Total",
    row_color: "C5E0B3",
    category: "Preparedness",
    sort_order: 12,
  },
  {
    kpi_code: "PPP 6",
    description: "Care Home Inspections",
    target_text: "1/4 of Total",
    row_color: "C5E0B3",
    category: "Preparedness",
    sort_order: 13,
  },
  {
    kpi_code: "H&S 1",
    description: "All TASS events closed within 14 days",
    target_text: "Full Compliance",
    row_color: "FFD966",
    category: "Safety & Assurance",
    sort_order: 14,
  },
] as const;

// ── Request / Response types ──────────────────────────────────────────────────

export interface CreateReportRequest {
  station_name?: string;
  watch: string;
  watch_commander_name: string;
  quarter: number;
  financial_year: number;
}

export interface CreateReportResponse {
  report: QuarterlyReport;
}

export interface ListReportsRequest {
  watch?: string;
  financial_year?: number;
  quarter?: number;
}

export interface ListReportsResponse {
  reports: QuarterlyReportSummary[];
}

export interface GetReportResponse {
  report: QuarterlyReport;
}

export interface UpdateItemRequest {
  met?: boolean;
  actual_value?: string;
  rationale?: string;
  target_text?: string;
}

export interface UpdateItemResponse {
  item: QuarterlyReportItem;
}

export interface UpdateReportRequest {
  notes?: string;
  status?: ReportStatus;
}

export interface UpdateReportResponse {
  report: QuarterlyReport;
}

export interface AddCustomItemRequest {
  description: string;
  target_text?: string;
}

export interface AddCustomItemResponse {
  item: QuarterlyReportCustomItem;
}

export interface UpdateCustomItemRequest {
  description?: string;
  target_text?: string;
  met?: boolean;
  rationale?: string;
}

export interface UpdateCustomItemResponse {
  item: QuarterlyReportCustomItem;
}
