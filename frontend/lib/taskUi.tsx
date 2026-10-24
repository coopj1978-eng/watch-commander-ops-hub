import { AlertCircle, Calendar, CheckCircle2, Clock, Repeat } from "lucide-react";
import type { Task } from "~backend/task/types";

// Shared bits for the Tasks pages in the v2 design (the --cal-* tokens in
// index.css): token-coloured chips for due date, priority and recurrence.

/** A small rounded chip coloured from a token family (station, day, leave…). */
export function Chip({
  k, icon, children, title, mono,
}: {
  k: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  title?: string;
  mono?: boolean;
}) {
  return (
    <span
      title={title}
      className={mono ? "cal-mono" : undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999,
        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
        background: k === "muted" ? "var(--cal-surface-3)" : `var(--cal-${k}-bg)`,
        color: k === "muted" ? "var(--cal-ink-2)" : `var(--cal-${k}-fg)`,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

/** Due-date chip: done, overdue, due today, due soon, or the date. */
export function DueChip({ task }: { task: Task }) {
  if (!task.due_at) return null;
  const due = new Date(task.due_at);
  const now = new Date();
  const diff = Math.round(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000
  );
  const ic = "h-3 w-3";
  if (task.status === "Done") return <Chip k="leave" icon={<CheckCircle2 className={ic} />}>Completed</Chip>;
  if (diff < 0) return <Chip k="station" icon={<AlertCircle className={ic} />}>Overdue {Math.abs(diff)}d</Chip>;
  if (diff === 0) return <Chip k="insp" icon={<Clock className={ic} />}>Due today</Chip>;
  if (diff <= 3) return <Chip k="day" icon={<Clock className={ic} />}>Due in {diff}d</Chip>;
  return (
    <Chip k="muted" icon={<Calendar className={ic} />} mono>
      {due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
    </Chip>
  );
}

/** Priority → token family: High red, Medium amber, Low blue. */
export const priorityKey = (p?: string) => (p === "High" ? "station" : p === "Med" ? "day" : "tasks");
export const priorityLabel = (p?: string) => (p === "Med" ? "Medium" : p ?? "Medium");

export function PriorityChip({ priority }: { priority?: string }) {
  return <Chip k={priorityKey(priority)}>{priorityLabel(priority)}</Chip>;
}

/** "Weekly on Mon, Thu" etc. from an RRULE, or null. */
export function describeRRule(rrule?: string | null): string | null {
  if (!rrule) return null;
  try {
    const freq = rrule.match(/FREQ=([^;]+)/)?.[1];
    const interval = parseInt(rrule.match(/INTERVAL=(\d+)/)?.[1] ?? "1");
    const byDay = rrule.match(/BYDAY=([^;]+)/)?.[1];
    if (!freq) return "Recurring";
    if (freq === "DAILY") return interval === 1 ? "Daily" : `Every ${interval} days`;
    if (freq === "WEEKLY") {
      const days = byDay
        ? byDay.split(",").map((d) => (({ MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" } as Record<string, string>)[d] ?? d)).join(", ")
        : null;
      if (days) return interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`;
      return interval === 1 ? "Weekly" : `Every ${interval} weeks`;
    }
    if (freq === "MONTHLY") return interval === 1 ? "Monthly" : `Every ${interval} months`;
    return "Recurring";
  } catch {
    return "Recurring";
  }
}

export function RecurChip({ rrule }: { rrule?: string | null }) {
  const text = describeRRule(rrule);
  if (!text) return null;
  return <Chip k="watch" icon={<Repeat className="h-3 w-3" />}>{text}</Chip>;
}

/** Checklist progress bar + "3/5". */
export function ChecklistBar({ task }: { task: Task }) {
  if (!task.checklist || task.checklist.length === 0) return null;
  const done = task.checklist.filter((i) => i.done).length;
  const total = task.checklist.length;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--cal-surface-3)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round((done / total) * 100)}%`, background: done === total ? "var(--cal-leave-dot)" : "var(--cal-brand)", borderRadius: 999 }} />
      </div>
      <span className="cal-mono" style={{ fontSize: 11, color: "var(--cal-muted)" }}>{done}/{total}</span>
    </div>
  );
}
