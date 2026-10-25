import { useEffect, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, Clock, Repeat } from "lucide-react";
import type { Task } from "~backend/task/types";
import { getLabelById } from "@/lib/taskLabels";

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
        display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px", borderRadius: 7,
        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
        background: k === "muted" ? "var(--cal-surface-2)" : `var(--cal-${k}-bg)`,
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
  if (diff === 0) return <Chip k="day" icon={<Clock className={ic} />}>Due today</Chip>;
  if (diff <= 3) return <Chip k="day" icon={<Clock className={ic} />}>Due in {diff}d</Chip>;
  return (
    <Chip k="muted" icon={<Calendar className={ic} />} mono>
      {due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
    </Chip>
  );
}

/** Priority → token family: High red, Medium amber, Low blue. */
export const priorityKey = (p?: string) => (p === "High" ? "station" : p === "Med" ? "day" : "watch");
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
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--cal-surface-3)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round((done / total) * 100)}%`, background: done === total ? "var(--cal-leave-dot)" : "var(--cal-brand)", borderRadius: 3 }} />
      </div>
      <span className="cal-mono" style={{ fontSize: 11, color: "var(--cal-ink-2)" }}>{done}/{total}</span>
    </div>
  );
}

/** A label as a tinted tag with its colour dot (Urgent, Routine…). */
export function LabelTag({ id }: { id: string }) {
  const label = getLabelById(id);
  if (!label) return null;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 8px", borderRadius: 7,
        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
        background: `var(--lb-${label.id}-bg)`, color: `var(--lb-${label.id}-fg)`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: label.colour }} />
      {label.name}
    </span>
  );
}

const PEOPLE = ["indigo", "teal", "rose", "amber", "slate"];

/** A person's fixed tint family (--pp-<key>-bg / -fg). */
export function personTint(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return PEOPLE[Math.abs(hash) % PEOPLE.length];
}

/** Someone's initials in a tinted rounded square; the tint is fixed per person. */
export function Initials({ userId, initials, size = 26 }: { userId: string; initials: string; size?: number }) {
  const k = personTint(userId);
  return (
    <span
      title={initials}
      aria-label={`Assigned to ${initials}`}
      className="cal-mono"
      style={{
        width: size, height: size, borderRadius: 8, flex: "none", display: "grid", placeItems: "center",
        fontSize: 10.5, fontWeight: 600, background: `var(--pp-${k}-bg)`, color: `var(--pp-${k}-fg)`,
      }}
    >
      {initials}
    </span>
  );
}

/**
 * Whether someone may change a task's details (title, due date, labels,
 * priority, repeat, delete…) — the same rule as the server's
 * task/permissions.ts: the person who set it, the person it's assigned to, or
 * a WC/CC on its watch (station cards have no watch). Anyone on the watch can
 * still move a card between columns and tick its checklist.
 */
export function canEditTaskDetails(
  task: { assigned_by?: string; assigned_to_user_id?: string; watch_unit?: string } | null | undefined,
  user: { id?: string; watch_unit?: string } | null | undefined,
  role: string,
): boolean {
  if (!task || !user?.id) return false;
  if (task.assigned_by === user.id || task.assigned_to_user_id === user.id) return true;
  const sameWatch = !task.watch_unit || task.watch_unit.toLowerCase() === (user.watch_unit ?? "").toLowerCase();
  return (role === "WC" || role === "CC") && sameWatch;
}

/** True below the md breakpoint (phones) — for layouts that differ, not just restyle. */
export function useIsPhone(): boolean {
  const query = "(max-width: 767px)";
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setIsPhone(m.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);
  return isPhone;
}
