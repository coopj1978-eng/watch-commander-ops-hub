import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, Repeat } from "lucide-react";
import { Chip, ChecklistBar, DueChip, PriorityChip, RecurChip, describeRRule, priorityKey } from "@/lib/taskUi";
import type { Task, TaskStatus, TaskPriority, TaskCategory } from "~backend/task/types";

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
}

type DueFilter = "all" | "overdue" | "today" | "week" | "month";

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

  // Status → token family (custom board columns fall back to muted).
  const statusKey = (status: string) =>
    ({ NotStarted: "muted", InProgress: "watch", Blocked: "insp", Done: "leave" } as Record<string, string>)[status] ?? "muted";

  const statusLabels: Record<TaskStatus, string> = {
    NotStarted: "Not Started",
    InProgress: "In Progress",
    Blocked: "Blocked",
    Done: "Done",
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all" || dueFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setDueFilter("all");
  };

  const th: React.CSSProperties = {
    textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: ".06em",
    textTransform: "uppercase", color: "var(--cal-muted)", borderBottom: "1px solid var(--cal-line)",
  };
  const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid var(--cal-line)", verticalAlign: "top" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="cal-card" style={{ padding: 10, display: "grid", gap: 8 }}>
        <div className="grid gap-2 md:grid-cols-6">
          <label className="md:col-span-2" style={{ position: "relative" }}>
            <Search className="h-4 w-4" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--cal-muted)" }} />
            <input
              id="search"
              aria-label="Search tasks"
              placeholder="Search tasks…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cal-field"
              style={{ width: "100%", paddingLeft: 32, boxSizing: "border-box" }}
            />
          </label>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")}>
            <SelectTrigger id="status-filter" aria-label="Status" className="h-10 rounded-[10px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="NotStarted">Not Started</SelectItem>
              <SelectItem value="InProgress">In Progress</SelectItem>
              <SelectItem value="Blocked">Blocked</SelectItem>
              <SelectItem value="Done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as TaskPriority | "all")}>
            <SelectTrigger id="priority-filter" aria-label="Priority" className="h-10 rounded-[10px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Med">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as TaskCategory | "all")}>
            <SelectTrigger id="category-filter" aria-label="Category" className="h-10 rounded-[10px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Training">Training</SelectItem>
              <SelectItem value="Inspection">Inspection</SelectItem>
              <SelectItem value="HFSV">HFSV</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dueFilter} onValueChange={(value) => setDueFilter(value as DueFilter)}>
            <SelectTrigger id="due-filter" aria-label="Due date" className="h-10 rounded-[10px]">
              <SelectValue placeholder="Due" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Due Dates</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Due Today</SelectItem>
              <SelectItem value="week">Due This Week</SelectItem>
              <SelectItem value="month">Due This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 4px" }}>
            <span style={{ fontSize: 13, color: "var(--cal-muted)" }}>Showing {filteredTasks.length} of {tasks.length} tasks</span>
            <button type="button" onClick={clearFilters} className="cal-btn" style={{ height: 32, padding: "0 12px", fontSize: 13 }}>
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ── Phone: cards ── */}
      <div className="grid gap-2 md:hidden">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" style={{ borderRadius: 14 }} />)
        ) : filteredTasks.length === 0 ? (
          <div style={{ border: "2px dashed var(--cal-line-2)", borderRadius: 14, padding: "36px 0", textAlign: "center", fontSize: 13, color: "var(--cal-muted)" }}>
            {hasActiveFilters ? "No tasks match your filters" : "No tasks yet"}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onTaskClick?.(task)}
              className="cal-card cal-focus"
              style={{ textAlign: "left", font: "inherit", color: "var(--cal-ink)", padding: 12, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", borderRadius: 14 }}
            >
              <span style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 6, flex: "none", background: `var(--cal-${priorityKey(task.priority)}-dot)` }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</span>
                  {task.description && (
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12.5, color: "var(--cal-muted)", marginTop: 2 }}>
                      {task.description}
                    </span>
                  )}
                </span>
              </span>
              <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Chip k={statusKey(task.status)}>{statusLabels[task.status] ?? task.status}</Chip>
                <PriorityChip priority={task.priority} />
                <Chip k="muted">{task.category}</Chip>
                <DueChip task={task} />
                <RecurChip rrule={task.rrule} />
              </span>
              <ChecklistBar task={task} />
            </button>
          ))
        )}
      </div>

      {/* ── Desktop: table ── */}
      <div className="cal-card hidden md:block" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr>
                <th style={th}>Title</th>
                <th style={th}>Status</th>
                <th style={th}>Priority</th>
                <th style={th}>Category</th>
                <th style={th}>Due</th>
                <th style={th}>Checklist</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} style={td}><Skeleton className="h-5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    tabIndex={0}
                    onClick={() => onTaskClick?.(task)}
                    onKeyDown={(e) => { if (e.key === "Enter") onTaskClick?.(task); }}
                    className="cal-focus hover:bg-[var(--cal-surface-2)]"
                    style={{ cursor: "pointer" }}
                  >
                    <td style={td}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: `var(--cal-${priorityKey(task.priority)}-dot)` }} />
                        <span style={{ fontWeight: 600 }}>{task.title}</span>
                        {task.rrule && <span title={describeRRule(task.rrule) ?? "Recurring"} style={{ display: "inline-flex", color: "var(--cal-watch-dot)" }}><Repeat className="h-3.5 w-3.5" /></span>}
                      </span>
                      {task.description && (
                        <span style={{ display: "block", fontSize: 12.5, color: "var(--cal-muted)", marginTop: 2, maxWidth: 420, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {task.description}
                        </span>
                      )}
                    </td>
                    <td style={td}><Chip k={statusKey(task.status)}>{statusLabels[task.status] ?? task.status}</Chip></td>
                    <td style={td}><PriorityChip priority={task.priority} /></td>
                    <td style={td}><Chip k="muted">{task.category}</Chip></td>
                    <td style={td}>{task.due_at ? <DueChip task={task} /> : <span style={{ color: "var(--cal-muted)" }}>—</span>}</td>
                    <td style={{ ...td, minWidth: 120 }}>
                      {task.checklist && task.checklist.length > 0 ? <ChecklistBar task={task} /> : <span style={{ color: "var(--cal-muted)" }}>—</span>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: "center", padding: "32px 0", color: "var(--cal-muted)" }}>
                    {hasActiveFilters ? "No tasks match your filters" : "No tasks yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
