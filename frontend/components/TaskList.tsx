import { useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ChevronDown, Repeat, Search } from "lucide-react";
import { describeRRule, priorityKey, priorityLabel } from "@/lib/taskUi";
import type { Task, TaskStatus, TaskPriority, TaskCategory } from "~backend/task/types";

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
}

type DueFilter = "all" | "overdue" | "today" | "week" | "month";

// Desktop table columns (Claude Design "List view"): title takes the slack.
const COLS = "minmax(0, 2.6fr) 130px 110px 120px 120px 180px";

const STATUS_OPTIONS = [
  { value: "NotStarted", label: "Not Started" },
  { value: "InProgress", label: "In Progress" },
  { value: "Blocked", label: "Blocked" },
  { value: "Done", label: "Done" },
];
const PRIORITY_OPTIONS = [
  { value: "High", label: "High" },
  { value: "Med", label: "Medium" },
  { value: "Low", label: "Low" },
];
const CATEGORY_OPTIONS = [
  { value: "Training", label: "Training" },
  { value: "Inspection", label: "Inspection" },
  { value: "HFSV", label: "HFSV" },
  { value: "Admin", label: "Admin" },
  { value: "Other", label: "Other" },
];
const DUE_OPTIONS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due this week" },
  { value: "month", label: "Due this month" },
];

type Tone = { bg: string; fg: string };
const MUTED: Tone = { bg: "var(--cal-surface-2)", fg: "var(--cal-ink-2)" };

/** Status → chip colours (custom board columns fall back to muted). */
const statusTone = (status: string): Tone =>
  ({
    InProgress: { bg: "var(--cal-brand-soft)", fg: "var(--cal-brand-text)" },
    Blocked: { bg: "var(--cal-station-bg)", fg: "var(--cal-station-fg)" },
    Done: { bg: "var(--cal-leave-bg)", fg: "var(--cal-leave-fg)" },
  } as Record<string, Tone>)[status] ?? MUTED;

/** Due text + colours — same rules as DueChip in lib/taskUi, without icons. */
function dueInfo(task: Task): (Tone & { text: string; mono?: boolean }) | null {
  if (!task.due_at) return null;
  const due = new Date(task.due_at);
  const now = new Date();
  const diff = Math.round(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000
  );
  if (task.status === "Done") return { text: "Completed", bg: "var(--cal-leave-bg)", fg: "var(--cal-leave-fg)" };
  if (diff < 0) return { text: `Overdue ${Math.abs(diff)}d`, bg: "var(--cal-station-bg)", fg: "var(--cal-station-fg)" };
  if (diff === 0) return { text: "Due today", bg: "var(--cal-day-bg)", fg: "var(--cal-day-fg)" };
  if (diff <= 3) return { text: `Due in ${diff}d`, bg: "var(--cal-day-bg)", fg: "var(--cal-day-fg)" };
  return { ...MUTED, text: due.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), mono: true };
}

/** Rounded chip: "lg" on the desktop table, "sm" on phone cards. */
function Pill({ tone, size, mono, children }: { tone: Tone; size: "sm" | "lg"; mono?: boolean; children: React.ReactNode }) {
  const lg = size === "lg";
  return (
    <span
      className={mono ? "cal-mono" : undefined}
      style={{
        display: "inline-flex", alignItems: "center", whiteSpace: "nowrap", fontWeight: 600,
        fontSize: lg ? 12 : 11, height: lg ? 26 : 24, padding: lg ? "0 10px" : "0 8px", borderRadius: lg ? 8 : 7,
        background: tone.bg, color: tone.fg,
      }}
    >
      {children}
    </span>
  );
}

const PriorityDot = ({ priority }: { priority?: string }) => (
  <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: `var(--cal-${priorityKey(priority)}-dot)` }} />
);

function RecurIcon({ rrule }: { rrule?: string }) {
  if (!rrule) return null;
  const text = describeRRule(rrule) ?? "Recurring";
  return (
    <span role="img" aria-label={text} title={text} style={{ display: "inline-flex", flex: "none", color: "var(--cal-brand-text)" }}>
      <Repeat className="h-3.5 w-3.5" strokeWidth={2.2} />
    </span>
  );
}

/** A filter drop-down: pill button that turns brand-tinted once a value is picked. */
function FilterSelect({
  id, label, value, onChange, options, allLabel, shortLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
  shortLabel: string;
}) {
  const active = value !== "all";
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={label}
        className={`cal-focus inline-flex items-center gap-1.5 text-[13px] md:gap-2 md:text-sm ${
          active ? "bg-(--cal-brand-soft)" : "bg-(--cal-surface) hover:bg-(--cal-surface-2)"
        }`}
        style={{
          flex: "none", height: 40, padding: active ? "0 11px" : "0 12px", borderRadius: 12, boxSizing: "border-box",
          border: active ? "2px solid var(--cal-brand)" : "1px solid var(--cal-line-2)",
          color: active ? "var(--cal-brand-text)" : "var(--cal-ink)", fontWeight: active ? 600 : 500,
          fontFamily: "inherit", lineHeight: 1.2, whiteSpace: "nowrap", cursor: "pointer", transition: "background-color .15s",
        }}
      >
        <SelectPrimitive.Value>
          {active ? (
            current
          ) : (
            <>
              <span className="md:hidden">{shortLabel}</span>
              <span className="hidden md:inline">{allLabel}</span>
            </>
          )}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" side="bottom" align="start" sideOffset={6} collisionPadding={12} className="cal-menu">
          <SelectPrimitive.Viewport>
            {[{ value: "all", label: allLabel }, ...options].map((o) => (
              <SelectPrimitive.Item key={o.value} value={o.value} className="cal-menu-item data-[state=checked]:font-semibold">
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator style={{ marginLeft: "auto", display: "inline-flex", color: "var(--cal-brand-text)" }}>
                  <Check className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export default function TaskList({ tasks, isLoading, onTaskClick }: TaskListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "all">("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");

  const filteredTasks = tasks.filter((task) => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    if (statusFilter !== "all" && task.status !== statusFilter) {
      return false;
    }

    if (priorityFilter !== "all" && task.priority !== priorityFilter) {
      return false;
    }

    if (categoryFilter !== "all" && task.category !== categoryFilter) {
      return false;
    }

    if (dueFilter !== "all" && task.due_at) {
      const dueDate = new Date(task.due_at);
      const now = new Date();
      const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

      if (dueFilter === "overdue" && diffDays >= 0) return false;
      if (dueFilter === "today" && diffDays !== 0) return false;
      if (dueFilter === "week" && (diffDays < 0 || diffDays > 7)) return false;
      if (dueFilter === "month" && (diffDays < 0 || diffDays > 30)) return false;
    }

    return true;
  });

  const statusLabels: Record<TaskStatus, string> = {
    NotStarted: "Not Started",
    InProgress: "In Progress",
    Blocked: "Blocked",
    Done: "Done",
  };

  const hasActiveFilters = Boolean(
    searchQuery || statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all" || dueFilter !== "all"
  );

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setDueFilter("all");
  };

  const checklistCount = (task: Task) => {
    if (!task.checklist || task.checklist.length === 0) return null;
    return { done: task.checklist.filter((i) => i.done).length, total: task.checklist.length };
  };

  const emptyText = hasActiveFilters ? "No tasks match your filters" : "No tasks yet";

  const rowGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: COLS, gap: 16, alignItems: "center" };

  return (
    <div className="flex flex-col gap-2.5 md:gap-4">
      {/* ── Filters: plain rows on phones, one card on desktop ── */}
      <section
        aria-label="Filters"
        className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-2 md:rounded-[20px] md:border md:border-(--cal-line) md:bg-(--cal-surface) md:p-3 md:shadow-(--cal-shadow)"
      >
        <label
          className="flex h-11 items-center gap-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--cal-brand) md:h-10 md:flex-[1_1_260px]"
          style={{ padding: "0 12px", borderRadius: 12, background: "var(--cal-surface-2)", color: "var(--cal-muted)", boxSizing: "border-box" }}
        >
          <Search className="h-4 w-4" aria-hidden style={{ flex: "none" }} />
          <input
            id="search"
            aria-label="Search tasks"
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-base placeholder:text-(--cal-muted) md:text-sm"
            style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontFamily: "inherit", color: "var(--cal-ink)", outline: "none" }}
          />
        </label>

        {/* Phones: one row that scrolls sideways. Desktop: the buttons join the card's row. */}
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] md:contents [&::-webkit-scrollbar]:hidden">
          <FilterSelect
            id="status-filter" label="Status" shortLabel="Status" allLabel="All statuses"
            value={statusFilter} onChange={(v) => setStatusFilter(v as TaskStatus | "all")} options={STATUS_OPTIONS}
          />
          <FilterSelect
            id="priority-filter" label="Priority" shortLabel="Priority" allLabel="All priorities"
            value={priorityFilter} onChange={(v) => setPriorityFilter(v as TaskPriority | "all")} options={PRIORITY_OPTIONS}
          />
          <FilterSelect
            id="category-filter" label="Category" shortLabel="Category" allLabel="All categories"
            value={categoryFilter} onChange={(v) => setCategoryFilter(v as TaskCategory | "all")} options={CATEGORY_OPTIONS}
          />
          <FilterSelect
            id="due-filter" label="Due date" shortLabel="Due" allLabel="All due dates"
            value={dueFilter} onChange={(v) => setDueFilter(v as DueFilter)} options={DUE_OPTIONS}
          />
        </div>

        {/* Count + Clear. Desktop always shows Clear (disabled until a filter is set); phones only when filtering. */}
        <div className={hasActiveFilters ? "flex items-center justify-between gap-2 md:contents" : "hidden md:contents"}>
          {hasActiveFilters && (
            <span aria-live="polite" style={{ fontSize: 13, color: "var(--cal-muted)", padding: "0 2px" }}>
              Showing <span className="cal-mono">{filteredTasks.length}</span> of <span className="cal-mono">{tasks.length}</span> tasks
            </span>
          )}
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            aria-label="Clear filters"
            className="cal-focus"
            style={{
              height: 40, padding: "0 10px", border: "none", borderRadius: 10, background: "transparent", fontFamily: "inherit",
              fontSize: 13, fontWeight: hasActiveFilters ? 600 : 500,
              color: hasActiveFilters ? "var(--cal-brand-text)" : "var(--cal-muted)",
              opacity: hasActiveFilters ? 1 : 0.6, cursor: hasActiveFilters ? "pointer" : "default",
            }}
          >
            Clear
          </button>
        </div>
      </section>

      {/* ── Phone: cards ── */}
      <div className="grid gap-2.5 md:hidden">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full" style={{ borderRadius: 16, background: "var(--cal-surface-3)" }} />
          ))
        ) : filteredTasks.length === 0 ? (
          <div style={{ border: "2px dashed var(--cal-line-2)", borderRadius: 16, padding: "36px 0", textAlign: "center", fontSize: 13, color: "var(--cal-muted)" }}>
            {emptyText}
          </div>
        ) : (
          filteredTasks.map((task) => {
            const due = dueInfo(task);
            const check = checklistCount(task);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onTaskClick?.(task)}
                className="cal-focus"
                style={{
                  display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 16,
                  border: "1px solid var(--cal-line)", background: "var(--cal-surface)", fontFamily: "inherit",
                  textAlign: "left", color: "var(--cal-ink)", cursor: "pointer", width: "100%", boxSizing: "border-box",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                  <PriorityDot priority={task.priority} />
                  <span className="sr-only">{priorityLabel(task.priority)} priority:</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</span>
                  <RecurIcon rrule={task.rrule} />
                </span>
                {task.description && (
                  <span
                    style={{
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      fontSize: 12.5, lineHeight: 1.4, color: "var(--cal-muted)", marginTop: -4, paddingLeft: 16,
                    }}
                  >
                    {task.description}
                  </span>
                )}
                <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", width: "100%" }}>
                  <Pill tone={statusTone(task.status)} size="sm">{statusLabels[task.status] ?? task.status}</Pill>
                  {due && <Pill tone={due} size="sm" mono={due.mono}>{due.text}</Pill>}
                  <span style={{ fontSize: 12, color: "var(--cal-muted)" }}>{task.category}</span>
                  {check && (
                    <span className="cal-mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--cal-ink-2)" }}>
                      <span className="sr-only">Checklist </span>
                      {check.done}/{check.total}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* ── Desktop: table ── */}
      <section
        aria-label="Tasks table"
        className="hidden md:block"
        style={{ background: "var(--cal-surface)", border: "1px solid var(--cal-line)", borderRadius: 22, boxShadow: "var(--cal-shadow)", overflowX: "auto" }}
      >
        <div role="table" aria-label="Tasks" style={{ minWidth: 940 }}>
          <div role="rowgroup">
            <div
              role="row"
              style={{
                ...rowGrid, padding: "14px 22px", borderBottom: "1px solid var(--cal-line)",
                fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--cal-muted)",
              }}
            >
              <span role="columnheader">Title</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Priority</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Due</span>
              <span role="columnheader">Checklist</span>
            </div>
          </div>

          <div role="rowgroup">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <div
                  key={i}
                  role="row"
                  style={{ ...rowGrid, minHeight: 56, padding: "0 22px", borderBottom: i < 4 ? "1px solid var(--cal-line)" : undefined }}
                >
                  {[...Array(6)].map((_, j) => (
                    <span key={j} role="cell">
                      <Skeleton className="h-5 w-full" style={{ background: "var(--cal-surface-3)" }} />
                    </span>
                  ))}
                </div>
              ))
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map((task, i) => {
                const done = task.status === "Done";
                const due = dueInfo(task);
                const check = checklistCount(task);
                const pct = check ? Math.round((check.done / check.total) * 100) : 0;
                return (
                  <div
                    key={task.id}
                    role="row"
                    tabIndex={0}
                    onClick={() => onTaskClick?.(task)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onTaskClick?.(task);
                      }
                    }}
                    className="cal-focus hover:bg-(--cal-surface-2)"
                    style={{
                      ...rowGrid, minHeight: 56, padding: "0 22px", color: "var(--cal-ink)", cursor: "pointer",
                      outlineOffset: -2, transition: "background-color .15s",
                      borderBottom: i < filteredTasks.length - 1 ? "1px solid var(--cal-line)" : undefined,
                    }}
                  >
                    <span role="cell" style={{ minWidth: 0, padding: "8px 0" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <PriorityDot priority={task.priority} />
                        <span
                          style={{
                            fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            ...(done ? { color: "var(--cal-ink-2)", textDecoration: "line-through" } : null),
                          }}
                        >
                          {task.title}
                        </span>
                        <RecurIcon rrule={task.rrule} />
                      </span>
                      {task.description && (
                        <span
                          style={{
                            display: "block", fontSize: 12, color: "var(--cal-muted)", marginTop: 1, paddingLeft: 18,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}
                        >
                          {task.description}
                        </span>
                      )}
                    </span>
                    <span role="cell">
                      <Pill tone={statusTone(task.status)} size="lg">{statusLabels[task.status] ?? task.status}</Pill>
                    </span>
                    <span role="cell">
                      <Pill
                        tone={{ bg: `var(--cal-${priorityKey(task.priority)}-bg)`, fg: `var(--cal-${priorityKey(task.priority)}-fg)` }}
                        size="lg"
                      >
                        {priorityLabel(task.priority)}
                      </Pill>
                    </span>
                    <span role="cell" style={{ fontSize: 13, color: "var(--cal-ink-2)" }}>{task.category}</span>
                    <span role="cell">
                      {due ? (
                        <Pill tone={due} size="lg" mono={due.mono}>{due.text}</Pill>
                      ) : (
                        <span style={{ color: "var(--cal-muted)" }}>—</span>
                      )}
                    </span>
                    <span role="cell" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        aria-hidden
                        style={{
                          flex: 1, height: 6, borderRadius: 3, overflow: "hidden", display: "block",
                          background: check ? "var(--cal-surface-3)" : "transparent",
                        }}
                      >
                        <span
                          style={{
                            display: "block", height: "100%", borderRadius: 3, width: `${pct}%`,
                            background: check && check.done === check.total ? "var(--cal-leave-dot)" : "var(--cal-brand)",
                          }}
                        />
                      </span>
                      <span
                        className="cal-mono"
                        style={{ fontSize: 12, color: check ? "var(--cal-ink-2)" : "var(--cal-muted)", width: 30, flex: "none" }}
                      >
                        {check ? `${check.done}/${check.total}` : "—"}
                      </span>
                    </span>
                  </div>
                );
              })
            ) : (
              <div role="row">
                <span role="cell" style={{ display: "block", textAlign: "center", padding: "32px 0", fontSize: 13.5, color: "var(--cal-muted)" }}>
                  {emptyText}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
