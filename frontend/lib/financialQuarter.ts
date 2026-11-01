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

const FY_QUARTER_MONTHS = ["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"];

/**
 * Multi-story inspection plans use SFRS financial quarters, like HFSV and
 * community targets (John, Nov 2026): Q1 = Apr–Jun … Q4 = Jan–Mar, and an
 * assignment's `year` is the April-start financial year.
 * e.g. financialQuarterLabel(2026, 3) → "Q3 2026/27 (Oct–Dec)".
 */
export function financialQuarterLabel(financialYear: number, quarter: number): string {
  return `Q${quarter} ${financialYear}/${String(financialYear + 1).slice(2)} (${financialQuarterMonths(quarter)})`;
}

/** Just the months of a financial quarter, e.g. 3 → "Oct–Dec". */
export function financialQuarterMonths(quarter: number): string {
  return FY_QUARTER_MONTHS[quarter - 1] ?? `Q${quarter}`;
}

/** "2026/27" for financial year 2026. */
export function financialYearLabel(financialYear: number): string {
  return `${financialYear}/${String(financialYear + 1).slice(2)}`;
}
