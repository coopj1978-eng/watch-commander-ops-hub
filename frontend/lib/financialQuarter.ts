/**
 * SFRS financial year quarters:
 *   Q1 = Apr–Jun  (months 3–5 in JS)
 *   Q2 = Jul–Sep  (months 6–8)
 *   Q3 = Oct–Dec  (months 9–11)
 *   Q4 = Jan–Mar  (months 0–2)
 *
 * financial_year is the April-start year:
 *   2025 = 2025/26 (Apr 2025 – Mar 2026)
 */

export interface FinancialPeriod {
  financial_year: number;
  quarter: number;
  label: string; // e.g. "Q1 2025/26"
}

export function getCurrentFinancialPeriod(date: Date = new Date()): FinancialPeriod {
  const m = date.getMonth(); // 0-indexed
  const y = date.getFullYear();

  let financial_year: number;
  let quarter: number;

  if (m >= 3 && m <= 5)   { financial_year = y;     quarter = 1; }
  else if (m >= 6 && m <= 8)  { financial_year = y;     quarter = 2; }
  else if (m >= 9 && m <= 11) { financial_year = y;     quarter = 3; }
  else                        { financial_year = y - 1; quarter = 4; } // Jan–Mar

  const label = `Q${quarter} ${financial_year}/${String(financial_year + 1).slice(2)}`;
  return { financial_year, quarter, label };
}

const CAL_QUARTER_MONTHS = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"];

/**
 * Inspection plans (multi-story) store CALENDAR quarters (Q4 = Oct–Dec).
 * Name the months and the matching financial quarter so they line up with
 * the HFSV / community targets, e.g. "Oct–Dec 2026 (Q3 2026/27)".
 */
export function calendarQuarterLabel(year: number, calQuarter: number): string {
  const months = CAL_QUARTER_MONTHS[calQuarter - 1] ?? `Q${calQuarter}`;
  const fy = calQuarter === 1 ? year - 1 : year;
  const fq = calQuarter === 1 ? 4 : calQuarter - 1;
  return `${months} ${year} (Q${fq} ${fy}/${String(fy + 1).slice(2)})`;
}

/** Just the months of a calendar quarter, e.g. "Oct–Dec". */
export function calendarQuarterMonths(calQuarter: number): string {
  return CAL_QUARTER_MONTHS[calQuarter - 1] ?? `Q${calQuarter}`;
}
