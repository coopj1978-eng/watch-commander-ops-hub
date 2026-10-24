import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { LayoutGrid, List, Plus, Repeat, Search, Palette, X as XIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUserRole } from "@/lib/rbac";
import TaskBoard from "@/components/TaskBoard";
import TaskList from "@/components/TaskList";
import TaskDetailDrawer from "@/components/TaskDetailDrawer";
import TaskTemplateManager from "@/components/TaskTemplateManager";
import { TASK_LABELS, BOARD_BACKGROUNDS, getBackground } from "@/lib/taskLabels";
import type { Task, ChecklistItem, TaskTemplate, TaskColumn } from "~backend/task/types";

export default function Tasks() {
  const { user } = useAuth();
  const userRole = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);

  // ── Background ───────────────────────────────────────────────────────────
  const [bgId, setBgId] = useState<string>(() => localStorage.getItem("task-board-bg") ?? "default");
  const [showBgPicker, setShowBgPicker] = useState(false);
  const bg = getBackground(bgId);
  const isDark = bg.dark;

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterSearch, setFilterSearch] = useState("");
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState("");
  const hasActiveFilters = filterSearch || filterLabels.length > 0 || filterOverdue || filterAssignee;

  const canAssignTasks = ["WC", "CC"].includes(userRole);
  const canEditStatus = ["WC", "CC", "FF"].includes(userRole);
  const watchName = user?.watch_unit ?? "Watch";

  const { data: tasks = [] as unknown as Task[], isLoading } = useQuery({
    queryKey: ["tasks", user?.watch_unit],
    queryFn: async () => (await backend.task.list({ watch_unit: user?.watch_unit, limit: 1000 })).tasks as unknown as Task[],
    enabled: !!user,
  });

  const { data: columnsData } = useQuery({
    queryKey: ["task-columns"],
    queryFn: async () => (await backend.task.listColumns()).columns,
  });
  const columns = (columnsData ?? []) as unknown as TaskColumn[];

  // ── Users for avatars ───────────────────────────────────────────────────
  const { data: profilesData } = useQuery({
    queryKey: ["profiles-for-tasks"],
    queryFn: async () => (await backend.profile.list({})).profiles ?? [],
    staleTime: 5 * 60 * 1000,
  });

  const userMap = useMemo(() => {
    const colours = ["#6366f1","#8b5cf6","#ec4899","#f97316","#14b8a6","#0ea5e9","#22c55e","#eab308"];
    const map: Record<string, { initials: string; colour: string }> = {};
    (profilesData ?? []).forEach((p: any, i: number) => {
      const name = (`${(p.first_name ?? "")} ${(p.last_name ?? "")}`).trim() || (p.email?.split("@")[0] ?? "?");
      const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
      map[p.user_id] = { initials, colour: colours[i % colours.length] };
    });
    return map;
  }, [profilesData]);

  // All watch members see all watch tasks — backend already scopes by watch_unit
  const filteredTasks = tasks;

  // ── KPI summary for the today-strip ─────────────────────────────────────
  // Derived live from the task list so the strip never disagrees with the
  // board below it. Mirrors the design's header strip:
  //   open · due this week · overdue · blocked · completed (7d) · in progress
  const taskStats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfDay.getTime() + 7 * 86_400_000);
    const sevenDaysAgo = new Date(startOfDay.getTime() - 7 * 86_400_000);

    let open = 0;
    let dueThisWeek = 0;
    let overdue = 0;
    let blocked = 0;
    let completedRecent = 0;
    let inProgress = 0;

    for (const t of tasks) {
      const status = (t.status ?? "").toLowerCase();
      const isDone = status === "done" || status === "completed";
      if (!isDone) open += 1;
      if (status.includes("progress")) inProgress += 1;
      if (status.includes("block")) blocked += 1;

      if (t.due_at && !isDone) {
        const due = new Date(t.due_at);
        if (!Number.isNaN(due.getTime())) {
          if (due < startOfDay) overdue += 1;
          else if (due < endOfWeek) dueThisWeek += 1;
        }
      }

      if (isDone && t.updated_at) {
        const updated = new Date(t.updated_at);
        if (!Number.isNaN(updated.getTime()) && updated >= sevenDaysAgo) {
          completedRecent += 1;
        }
      }
    }

    return { open, dueThisWeek, overdue, blocked, completedRecent, inProgress };
  }, [tasks]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => backend.task.create({ ...data, assigned_by: user?.id || "" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast({ title: "Error", description: "Failed to create task", variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (params: { id: number } & any) => { const { id, ...rest } = params; return backend.task.update(id, rest); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast({ title: "Error", description: "Failed to update task", variant: "destructive" }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleTaskCreate = (title: string, statusKey: string) => {
    const colTasks = filteredTasks.filter((t) => t.status === statusKey);
    const maxPos = colTasks.reduce((max, t) => Math.max(max, t.position ?? 0), 0);
    createTaskMutation.mutate({ title, category: "Other", priority: "Med", status: statusKey, position: maxPos + 1, watch_unit: user?.watch_unit });
  };

  const handleNewTask = () => {
    const firstCol = columns[0];
    createTaskMutation.mutateAsync({
      title: "New Task",
      category: "Other",
      priority: "Med",
      status: firstCol?.status_key ?? "NotStarted",
      position: 0,
      watch_unit: user?.watch_unit,
    }).then((newTask) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsNewTask(true);
      setSelectedTask(newTask as unknown as Task);
    }).catch(() => {});
  };

  const handleTitleEdit = (taskId: number, newTitle: string) => {
    updateTaskMutation.mutate({ id: taskId, title: newTitle });
    if (selectedTask?.id === taskId) setSelectedTask((prev) => prev ? { ...prev, title: newTitle } : prev);
  };

  const handleChecklistToggle = (taskId: number, itemLabel: string, done: boolean) => {
    const task = filteredTasks.find((t) => t.id === taskId);
    if (!task || !task.checklist) return;
    const updatedChecklist = task.checklist.map((item) => item.label === itemLabel ? { ...item, done } : item);
    updateTaskMutation.mutate({ id: taskId, checklist: updatedChecklist });
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    const task = filteredTasks.find((t) => t.id === taskId);
    if (!task) return;
    updateTaskMutation.mutate({ id: taskId, status: newStatus });
  };

  const handleUseTemplate = (template: TaskTemplate) => {
    const firstCol = columns[0];
    const checklist: ChecklistItem[] = (template.checklist ?? []).map((item) => ({ ...item, done: false }));
    createTaskMutation.mutate({
      title: template.title_template,
      description: template.task_description ?? undefined,
      category: template.category,
      priority: template.priority,
      checklist,
      rrule: template.rrule,
      status: firstCol?.status_key ?? "NotStarted",
      watch_unit: user?.watch_unit,
    });
    toast({ title: "Task created", description: `"${template.title_template}" added to board` });
  };

  const handleBgChange = (id: string) => {
    setBgId(id);
    localStorage.setItem("task-board-bg", id);
    setShowBgPicker(false);
  };

  const syncedSelectedTask = selectedTask ? (tasks.find((t) => t.id === selectedTask.id) ?? selectedTask) : null;
  const boardFilters = { search: filterSearch, labels: filterLabels, overdueOnly: filterOverdue, assignee: filterAssignee };

  // On a dark board background the page header text turns white; the
  // cards and columns keep their own surfaces either way.
  const headerInk = isDark ? "#fff" : "var(--cal-ink)";
  const headerMuted = isDark ? "rgba(255,255,255,.7)" : "var(--cal-muted)";

  const stats: { key: string; label: string; value: number; k?: string; onClick?: () => void; pressed?: boolean }[] = [
    { key: "open", label: "Open", value: taskStats.open },
    { key: "week", label: "Due this week", value: taskStats.dueThisWeek, k: taskStats.dueThisWeek > 0 ? "day" : undefined },
    {
      key: "overdue", label: "Overdue", value: taskStats.overdue, k: taskStats.overdue > 0 ? "station" : undefined,
      onClick: () => setFilterOverdue(!filterOverdue), pressed: filterOverdue,
    },
    { key: "blocked", label: "Blocked", value: taskStats.blocked, k: taskStats.blocked > 0 ? "insp" : undefined },
    { key: "progress", label: "In progress", value: taskStats.inProgress, k: taskStats.inProgress > 0 ? "watch" : undefined },
    { key: "done", label: "Completed (7d)", value: taskStats.completedRecent, k: taskStats.completedRecent > 0 ? "leave" : undefined },
  ];

  const chip = (active: boolean, colour?: string): React.CSSProperties => ({
    height: 30, padding: "0 12px", borderRadius: 999, font: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
    ...(active
      ? { background: colour ?? "var(--cal-brand)", color: "#fff", border: "1px solid transparent" }
      : { background: "var(--cal-surface)", color: "var(--cal-ink-2)", border: "1px solid var(--cal-line-2)" }),
  });

  return (
    <div
      className="cal-ui min-h-screen -m-4 md:-m-8 p-4 md:p-8 transition-all duration-500"
      style={{ display: "flex", flexDirection: "column", gap: 16, ...(bgId !== "default" ? { background: bg.style.replace("background: ", "") } : {}) }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="cal-mono" style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: headerMuted }}>
            {watchName} Watch · {tasks.length} total
            {taskStats.overdue > 0 && <span style={{ color: isDark ? "#fecaca" : "var(--cal-now)" }}> · {taskStats.overdue} overdue</span>}
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.05, fontWeight: 600, letterSpacing: "-.02em", color: headerInk }}>
            Tasks
          </h1>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {/* Board / List */}
          <div role="group" aria-label="View" style={{ display: "inline-flex", padding: 4, borderRadius: 14, background: "var(--cal-surface-3)", gap: 2 }}>
            {([["board", "Board", LayoutGrid], ["list", "List", List]] as const).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className="cal-focus"
                style={{
                  height: 36, padding: "0 14px", borderRadius: 10, border: "none", font: "inherit", fontSize: 14, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  ...(viewMode === mode
                    ? { background: "var(--cal-surface)", color: "var(--cal-ink)", fontWeight: 600, boxShadow: "var(--cal-shadow)" }
                    : { background: "transparent", color: "var(--cal-ink-2)", fontWeight: 500 }),
                }}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Background picker */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowBgPicker(!showBgPicker)}
              aria-label="Board background"
              aria-expanded={showBgPicker}
              title="Board background"
              className="cal-btn"
              style={{ width: 44, height: 44, padding: 0, ...(showBgPicker ? { borderColor: "var(--cal-brand)", color: "var(--cal-brand)" } : {}) }}
            >
              <Palette className="h-[18px] w-[18px]" />
            </button>
            {showBgPicker && (
              <div className="cal-card" style={{ position: "absolute", right: 0, top: 52, zIndex: 50, width: 288, padding: 16, boxShadow: "var(--cal-pop)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Board background</span>
                  <button type="button" aria-label="Close" onClick={() => setShowBgPicker(false)} className="cal-btn" style={{ width: 32, height: 32, padding: 0, borderRadius: 10 }}>
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {BOARD_BACKGROUNDS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBgChange(b.id)}
                      title={b.name}
                      aria-label={b.name}
                      aria-pressed={bgId === b.id}
                      className="cal-focus"
                      style={{
                        height: 44, borderRadius: 12, cursor: "pointer", background: b.style.replace("background: ", ""),
                        border: bgId === b.id ? "2px solid var(--cal-brand)" : "2px solid transparent",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <button type="button" onClick={() => setShowTemplateManager(true)} aria-label="Templates" className="cal-btn" style={{ height: 44, padding: "0 16px", fontSize: 14 }}>
            <Repeat className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Templates</span>
          </button>
          <button
            type="button"
            onClick={handleNewTask}
            aria-label="New Task"
            className="cal-focus"
            style={{ height: 44, padding: "0 18px", borderRadius: 12, border: "none", background: "var(--cal-brand)", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Plus className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {viewMode === "board" && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          {stats.map((st) => {
            const Tag = st.onClick ? "button" : "div";
            return (
              <Tag
                key={st.key}
                {...(st.onClick ? { type: "button" as const, onClick: st.onClick, "aria-pressed": st.pressed, title: "Show only overdue tasks" } : {})}
                className={`cal-card px-2.5 py-2 sm:px-3.5 sm:py-3${st.onClick ? " cal-focus" : ""}`}
                style={{
                  display: "flex", flexDirection: "column", gap: 4, textAlign: "left", font: "inherit",
                  cursor: st.onClick ? "pointer" : undefined, color: "var(--cal-ink)",
                  ...(st.pressed ? { boxShadow: "0 0 0 2px var(--cal-station-dot), var(--cal-shadow)" } : {}),
                }}
              >
                <span className="text-[10px] sm:text-[11px]" style={{ fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--cal-muted)" }}>{st.label}</span>
                <span className="cal-mono text-[22px] sm:text-[28px]" style={{ fontWeight: 600, lineHeight: 1, color: st.k ? `var(--cal-${st.k}-fg)` : "var(--cal-ink)" }}>
                  {st.value}
                </span>
              </Tag>
            );
          })}
        </div>
      )}

      {/* ── Filters (board) ──────────────────────────────────────────────── */}
      {viewMode === "board" && (
        <div className="cal-card" style={{ padding: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <label style={{ position: "relative", flex: "1 1 180px", maxWidth: 320 }}>
            <Search className="h-4 w-4" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--cal-muted)" }} />
            <input
              aria-label="Search tasks"
              placeholder="Search tasks…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="cal-field"
              style={{ width: "100%", paddingLeft: 32, boxSizing: "border-box" }}
            />
          </label>

          <div className="hidden sm:flex" style={{ alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {TASK_LABELS.map((label) => {
              const active = filterLabels.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilterLabels(active ? filterLabels.filter((l) => l !== label.id) : [...filterLabels, label.id])}
                  className="cal-focus"
                  style={chip(active, label.colour)}
                >
                  {!active && <span style={{ width: 8, height: 8, borderRadius: "50%", background: label.colour }} />}
                  {label.name}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-pressed={filterOverdue}
            onClick={() => setFilterOverdue(!filterOverdue)}
            className="cal-focus"
            style={chip(filterOverdue, "var(--cal-station-dot)")}
          >
            Overdue only
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setFilterSearch(""); setFilterLabels([]); setFilterOverdue(false); setFilterAssignee(""); }}
              title="Clear filters"
              className="cal-focus"
              style={{ ...chip(false), border: "none", background: "transparent", color: "var(--cal-muted)" }}
            >
              <XIcon className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* ── Board / List ────────────────────────────────────────────────────── */}
      {viewMode === "board" ? (
        <TaskBoard
          tasks={filteredTasks}
          isLoading={isLoading}
          onTaskClick={setSelectedTask}
          onChecklistToggle={handleChecklistToggle}
          onStatusChange={handleStatusChange}
          onTaskCreate={handleTaskCreate}
          onTitleEdit={handleTitleEdit}
          canEdit={canEditStatus}
          canManageColumns={canAssignTasks}
          filters={boardFilters}
          isDark={isDark}
          userMap={userMap}
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          isLoading={isLoading}
          onTaskClick={setSelectedTask}
        />
      )}

      {/* ── Task Detail Drawer ──────────────────────────────────────────────── */}
      <TaskDetailDrawer
        task={syncedSelectedTask}
        columns={columns}
        onClose={() => { setSelectedTask(null); setIsNewTask(false); }}
        onDelete={() => { setSelectedTask(null); setIsNewTask(false); }}
        canEdit={canEditStatus}
        isNewTask={isNewTask}
      />

      {/* ── Template Manager ────────────────────────────────────────────────── */}
      <TaskTemplateManager
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        onUseTemplate={handleUseTemplate}
        canManage={canAssignTasks}
      />
    </div>
  );
}
