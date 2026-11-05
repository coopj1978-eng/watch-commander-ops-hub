import type { shift_adjustments } from "@/client";

// Flexi Day and Head for Head requests: the words the screens share, and the
// records download. The rules themselves live on the server
// (backend/lib/shiftRequests.ts).

type Req = shift_adjustments.ShiftRequest;

export const REQUEST_LABEL: Record<shift_adjustments.RequestType, string> = {
  flexi: "Flexi Day",
  h4h: "Head for Head",
};

export const STATUS_LABEL: Record<shift_adjustments.RequestStatus, string> = {
  with_cover: "Waiting for cover to agree",
  cover_declined: "Cover said no",
  with_wc: "With the WC",
  authorised: "Authorised: submit on Kronos",
  referred: "Referred: submit on Kronos",
  declined: "Declined by WC",
  approved: "Approved",
  not_approved: "Declined on Kronos",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
};

export const dayText = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export const stampText = (at: string) =>
  new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const deadlineText = (at: string) =>
  new Date(at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Who signed, and as what. A CC signs when the WC is off. */
export function signedAs(r: Pick<Req, "decided_by_name" | "decided_by_role">): string {
  if (!r.decided_by_name) return "";
  return r.decided_by_role === "CC" ? `${r.decided_by_name} (CC, WC off)` : `${r.decided_by_name} (${r.decided_by_role})`;
}

/** Quote a spreadsheet cell, and stop a typed comment running as a formula. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const COLUMNS: [string, (r: Req) => string | number | null][] = [
  ["Ref", (r) => r.id],
  ["Type", (r) => REQUEST_LABEL[r.type]],
  ["Name", (r) => r.user_name],
  ["Role", (r) => r.user_role],
  ["Payroll number", (r) => r.payroll_number],
  ["Station", (r) => r.station],
  ["Watch", (r) => r.watch],
  ["Date requested", (r) => r.shift_date],
  ["Shift", (r) => r.shift_type],
  ["Submitted", (r) => r.created_at.slice(0, 10)],
  ["Status", (r) => STATUS_LABEL[r.status]],
  ["Working H4H", (r) => r.cover_name],
  ["Their payroll number", (r) => r.cover_payroll],
  ["Their station", (r) => r.cover_station],
  ["Their watch", (r) => r.cover_watch],
  ["Signed by", (r) => signedAs(r)],
  ["Signed on", (r) => r.decided_at?.slice(0, 10) ?? ""],
  ["Pinch point", (r) => r.pinch_point],
  ["WC agreed over limit", (r) => (r.over_limit_agreed ? "Yes" : "")],
  ["SC endorsed over limit", (r) => (r.sc_endorsed ? "Yes" : "")],
  ["WC comments", (r) => r.wc_comments],
  ["Kronos result recorded", (r) => r.outcome_at?.slice(0, 10) ?? ""],
  ["Recorded by", (r) => r.outcome_by_name],
  ["Payback date", (r) => r.payback_date],
  ["Payback shift", (r) => r.payback_day_night],
];

export function requestsCsv(rows: Req[]): string {
  const lines = [COLUMNS.map(([h]) => csvCell(h)).join(",")];
  for (const r of rows) lines.push(COLUMNS.map(([, get]) => csvCell(get(r))).join(","));
  return lines.join("\r\n");
}
