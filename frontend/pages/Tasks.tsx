import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { ArrowRightLeft, Check, Filter, LayoutGrid, List, Plus, Repeat, Search, Palette, X as XIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUserRole } from "@/lib/rbac";
import TaskBoard from "@/components/TaskBoard";
import TaskList from "@/components/TaskList";
import TaskDetailDrawer from "@/components/TaskDetailDrawer";
import TaskTemplateManager from "@/components/TaskTemplateManager";
import TaskSidePanel, { TaskWeekStrip } from "@/components/TaskSidePanel";
import { personTint, useIsPhone } from "@/lib/taskUi";
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
  // Day picked on the watch calendar panel — the panel lists what's planned that day.
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const hasActiveFilters = !!(filterSearch || filterLabels.length > 0 || filterOverdue || filterAssignee);
  const clearFilters = () => { setFilterSearch(""); setFilterLabels([]); setFilterOverdue(false); setFilterAssignee(""); };
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const isPhone = useIsPhone();

  const canAssignTasks = ["WC", "CC"].includes(userRole);
  const canEditStatus = ["WC", "CC", "FF"].includes(userRole);
  const watchName = user?.watch_unit ?? "Watch";

  const { data: tasks = [] as unknown as Task[], isLoading } = useQuery({
    queryKey: ["tasks", user?.watch_unit],
    queryFn: async () => (await backend.task.list({ watch_unit: user?.watch_unit, limit: 1000 })).tasks as unknown as Task[],
    enabled: !!user,
  });

  // ── The shift board ─────────────────────────────────────────────────────
  // "duty": the watch on duty now — everyone working this shift (head-for-heads
  // and overtime too) sees the same board. "mine": your own watch's current
  // or next shift. Station checks, the watch's tasks due by the end of the
  // shift (unfinished ones roll on by themselves) and the calendar's tasks.
  const [boardView, setBoardView] = useState<"duty" | "mine">("duty");
  const { data: shiftData, isLoading: shiftLoading } = useQuery({
    queryKey: ["tasks", "shift", boardView, user?.watch_unit],
    queryFn: () => backend.task.shiftBoard({ watch: boardView === "mine" ? user?.watch_unit : undefined }),
    enabled: !!user,
    refetchInterval: 60_000, // rolls over at 08:00 and 18:00
  });
  const shift = shiftData?.shift;
  const shiftTasks = useMemo(() => (shiftData?.tasks ?? []) as unknown as Task[], [shiftData]);
  const boardWatch = shift?.watch ?? user?.watch_unit;
  const myWatchOnDuty = !shiftData || (shiftData.on_duty_watch ?? "").toLowerCase() === (user?.watch_unit ?? "").toLowerCase();

  // "For info" handover lines for the watch on this board: from the last
  // shift until they're marked read, plus anything kept on until a date.
  const { data: notesData } = useQuery({
    queryKey: ["handover-notes", boardWatch],
    queryFn: () => backend.handover.boardNotes({ watch: boardWatch! }),
    enabled: !!boardWatch,
    refetchInterval: 60_000,
  });
  const handoverNotes = notesData?.notes ?? [];
  const markReadMutation = useMutation({
    mutationFn: (id: number) => backend.handover.markRead(id, { watch: boardWatch! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handover-notes"] });
      queryClient.invalidateQueries({ queryKey: ["handovers"] });
    },
  });

  const { data: columnsData } = useQuery({
    queryKey: ["task-columns"],
    queryFn: async () => (await backend.task.listColumns()).columns,
  });
  const columns = (columnsData ?? []) as unknown as TaskColumn[];

  // ── People (names → initials for cards and the "filter by person" row) ─
  const { data: peopleData } = useQuery({
    queryKey: ["people-for-tasks"],
    queryFn: async () => (await backend.profile.listWithUsers({ limit: 500 })).people ?? [],
    staleTime: 5 * 60 * 1000,
  });
  const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  const userMap = useMemo(() => {
    const map: Record<string, { initials: string; colour: string }> = {};
    for (const p of peopleData ?? []) {
      const name = p.user.name || p.user.email?.split("@")[0] || "?";
      map[p.user.id] = { initials: initialsOf(name), colour: "" };
    }
    return map;
  }, [peopleData]);

  // This watch's members for the person filter (you first).
  const people = useMemo(() => {
    const watch = (user?.watch_unit ?? "").toLowerCase();
    return (peopleData ?? [])
      .filter((p) => watch && (p.user.watch_unit ?? "").toLowerCase() === watch)
      .map((p) => {
        const name = p.user.name || p.user.email?.split("@")[0] || "?";
        return { id: p.user.id, name, initials: initialsOf(name) };
      })
      .sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : a.name.localeCompare(b.name)));
  }, [peopleData, user?.id, user?.watch_unit]);

  // Board actions look tasks up here: the shift board's cards plus the watch's list.
  const filteredTasks = useMemo(() => {
    const byId = new Map<number, Task>();
    for (const t of [...tasks, ...shiftTasks]) byId.set(t.id, t);
    return [...byId.values()];
  }, [tasks, shiftTasks]);

  const shiftStats = useMemo(() => {
    const start = shift ? new Date(shift.start) : null;
    let todo = 0, checks = 0, carried = 0, done = 0;
    for (const t of shiftTasks as (Task & { kind?: string })[]) {
      if (t.status === "Done") { done++; continue; }
      todo++;
      if (t.kind === "check") checks++;
      else if (start && t.due_at && new Date(t.due_at) < start) carried++;
    }
    return { todo, checks, carried, done };
  }, [shiftTasks, shift]);

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
    createTaskMutation.mutate({ title, category: "Other", priority: "Med", status: statusKey, position: maxPos + 1, watch_unit: boardWatch, due_date: shift ? new Date(shift.start) : undefined });
  };

  const handleNewTask = () => {
    const firstCol = columns[0];
    createTaskMutation.mutateAsync({
      title: "New Task",
      category: "Other",
      priority: "Med",
      status: firstCol?.status_key ?? "NotStarted",
      position: 0,
      watch_unit: boardWatch,
      due_date: shift ? new Date(shift.start) : undefined,
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
      status: firstCol?.status_key ?? "NotStarted",
      watch_unit: boardWatch,
      due_date: shift ? new Date(shift.start) : undefined,
    });
    toast({ title: "Task created", description: `"${template.title_template}" added to board` });
  };

  const handleBgChange = (id: string) => {
    setBgId(id);
    localStorage.setItem("task-board-bg", id);
    setShowBgPicker(false);
  };

  const syncedSelectedTask = selectedTask ? (filteredTasks.find((t) => t.id === selectedTask.id) ?? selectedTask) : null;
  const boardFilters = { search: filterSearch, labels: filterLabels, overdueOnly: filterOverdue, assignee: filterAssignee };
  const activeFilterCount = [filterSearch, filterLabels.length, filterOverdue, filterAssignee].filter(Boolean).length;
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const shiftWhen = shift
    ? `${shift.label} ${hhmm(shift.start)}–${hhmm(shift.end)}${shift.on_duty ? " · on duty" : ` · ${new Date(shift.start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`}`
    : "";
  const toggleLabel = (id: string) => setFilterLabels(filterLabels.includes(id) ? filterLabels.filter((l) => l !== id) : [...filterLabels, id]);

  // On a dark board background the page header text turns white; the
  // cards and columns keep their own surfaces either way.
  const headerInk = isDark ? "#fff" : "var(--cal-ink)";
  const headerMuted = isDark ? "rgba(255,255,255,.75)" : "var(--cal-muted)";

  // Counts for the shift shown. "Carried over" doubles as the overdue filter.
  const stats: { key: string; label: string; value: number; over?: boolean }[] = [
    { key: "todo", label: "To do this shift", value: shiftStats.todo },
    { key: "checks", label: "Station checks left", value: shiftStats.checks },
    { key: "carried", label: "Carried over", value: shiftStats.carried, over: true },
    { key: "done", label: "Done this shift", value: shiftStats.done },
  ];

  const iconBtn: React.CSSProperties = { width: 44, height: 44, padding: 0, position: "relative" };

  const bgPicker = showBgPicker && (
    <div role="dialog" aria-label="Board background" className="cal-card" style={{ position: "absolute", right: 0, top: 52, zIndex: 50, width: 340, maxWidth: "calc(100vw - 32px)", padding: 16, boxShadow: "var(--cal-pop)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Board background</span>
        <button type="button" aria-label="Close" onClick={() => setShowBgPicker(false)} className="cal-btn" style={{ width: 32, height: 32, padding: 0, borderRadius: 10 }}>
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        {BOARD_BACKGROUNDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => handleBgChange(b.id)}
            aria-pressed={bgId === b.id}
            className="cal-focus"
            style={{ border: "none", background: "transparent", padding: 0, font: "inherit", display: "flex", flexDirection: "column", gap: 4, cursor: "pointer", borderRadius: 12 }}
          >
            <span
              style={{
                display: "block", height: 44, borderRadius: 12, background: b.style.replace("background: ", ""),
                boxShadow: bgId === b.id ? "0 0 0 2px var(--cal-surface), 0 0 0 4px var(--cal-brand)" : "inset 0 0 0 1px rgba(0,0,0,.06)",
              }}
            />
            <span style={{ fontSize: 11, color: "var(--cal-ink-2)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const personButton = (p: { id: string; name: string; initials: string }, size: number) => {
    const on = filterAssignee === p.id;
    const k = personTint(p.id);
    return (
      <button
        key={p.id}
        type="button"
        aria-pressed={on}
        aria-label={`Show ${p.id === user?.id ? "my" : `${p.name}'s`} tasks`}
        title={p.name}
        onClick={() => setFilterAssignee(on ? "" : p.id)}
        className="cal-focus cal-mono"
        style={{
          width: size, height: size, borderRadius: size > 36 ? 12 : 9, border: "none", fontSize: size > 36 ? 12 : 11, fontWeight: 600, cursor: "pointer",
          background: `var(--pp-${k}-bg)`, color: `var(--pp-${k}-fg)`,
          boxShadow: on ? "0 0 0 2px var(--cal-surface), 0 0 0 4px var(--cal-ink)" : undefined,
        }}
      >
        {p.initials}
      </button>
    );
  };

  // Your watch isn't on: switch between the shift on duty and your own watch's next shift.
  const viewSwitch = !myWatchOnDuty && shiftData?.on_duty_watch && user?.watch_unit ? (
    <div role="group" aria-label="Which board" style={{ display: "inline-flex", alignSelf: "flex-start", padding: 4, borderRadius: 12, background: "var(--cal-surface-3)", gap: 2 }}>
      {([["duty", `On duty · ${shiftData.on_duty_watch}`], ["mine", `My watch · ${user.watch_unit}`]] as const).map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={boardView === v}
          onClick={() => setBoardView(v)}
          className="cal-focus"
          style={{
            height: 34, padding: "0 12px", borderRadius: 9, border: "none", font: "inherit", fontSize: 13, cursor: "pointer",
            ...(boardView === v
              ? { background: "var(--cal-surface)", color: "var(--cal-ink)", fontWeight: 600, boxShadow: "var(--cal-shadow)" }
              : { background: "transparent", color: "var(--cal-ink-2)", fontWeight: 500 }),
          }}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div
      className="cal-ui min-h-screen -m-4 md:-m-8 p-4 md:p-6 transition-all duration-500"
      style={bgId !== "default" ? { background: bg.style.replace("background: ", "") } : undefined}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        {/* ════════════════ Main ════════════════ */}
        <main style={{ flex: "999 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16, paddingBottom: isPhone ? 72 : 0 }}>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="cal-mono" style={{ fontSize: isPhone ? 11 : 12, letterSpacing: ".12em", textTransform: "uppercase", color: headerMuted }}>
                {viewMode === "board" && shift
                  ? <>{boardWatch} Watch · {shiftWhen}</>
                  : <>{watchName} Watch · {tasks.length}{isPhone ? "" : " total"}</>}
              </span>
              <h1 style={{ margin: 0, fontSize: isPhone ? 28 : 40, lineHeight: 1.05, fontWeight: 600, letterSpacing: "-.02em", color: headerInk }}>Tasks</h1>
            </div>

            {isPhone ? (
              <div style={{ display: "flex", gap: 6, position: "relative" }}>
                <button type="button" onClick={() => setShowFilterSheet(true)} aria-label={`Filters, ${activeFilterCount ? `${activeFilterCount} active` : "none active"}`} className="cal-btn" style={iconBtn}>
                  <Filter className="h-[18px] w-[18px]" />
                  {activeFilterCount > 0 && (
                    <span className="cal-mono" style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: "var(--cal-brand)", color: "#fff", fontSize: 10, fontWeight: 600, display: "grid", placeItems: "center", padding: "0 4px" }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <button type="button" onClick={() => setViewMode(viewMode === "board" ? "list" : "board")} aria-label={viewMode === "board" ? "Switch to list" : "Switch to board"} className="cal-btn" style={iconBtn}>
                  {viewMode === "board" ? <List className="h-[18px] w-[18px]" /> : <LayoutGrid className="h-[18px] w-[18px]" />}
                </button>
                <button type="button" onClick={() => setShowBgPicker(!showBgPicker)} aria-label="Board background" aria-expanded={showBgPicker} className="cal-btn" style={iconBtn}>
                  <Palette className="h-[18px] w-[18px]" />
                </button>
                <button type="button" onClick={() => setShowTemplateManager(true)} aria-label="Templates" className="cal-btn" style={iconBtn}>
                  <Repeat className="h-[18px] w-[18px]" />
                </button>
                {bgPicker}
              </div>
            ) : (
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
                      {label}
                    </button>
                  ))}
                </div>

                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setShowBgPicker(!showBgPicker)}
                    aria-label="Board background"
                    aria-expanded={showBgPicker}
                    title="Board background"
                    className="cal-btn"
                    style={{ ...iconBtn, ...(showBgPicker ? { borderColor: "var(--cal-brand)", color: "var(--cal-brand)" } : {}) }}
                  >
                    <Palette className="h-[18px] w-[18px]" />
                  </button>
                  {bgPicker}
                </div>

                <button type="button" onClick={() => setShowTemplateManager(true)} className="cal-btn" style={{ height: 44, padding: "0 16px", fontSize: 14 }}>
                  <Repeat className="h-[17px] w-[17px]" />
                  Templates
                </button>
                <button
                  type="button"
                  onClick={handleNewTask}
                  className="cal-focus"
                  style={{
                    height: 46, padding: "0 8px 0 20px", borderRadius: 999, border: "none", background: "var(--cal-brand)", color: "#fff",
                    font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10,
                    boxShadow: "0 8px 20px rgba(67,56,202,.32)",
                  }}
                >
                  Create Task
                  <span style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.22)", display: "grid", placeItems: "center" }}>
                    <Plus className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                </button>
              </div>
            )}
          </div>

          {viewMode === "board" && viewSwitch}

          {/* ── Handover notes for this watch ───────────────────────────────── */}
          {viewMode === "board" && handoverNotes.length > 0 && (
            <section aria-label="Handover notes" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {handoverNotes.map((n) => {
                const when = new Date(`${n.shift_date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div key={n.handover_id} style={{ background: "var(--cal-watch-bg)", color: "var(--cal-watch-fg)", borderRadius: 16, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <ArrowRightLeft className="h-4 w-4" />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        Handover from {n.from_watch} Watch · {n.shift_type} {when}
                      </span>
                      {n.written_by_name && <span style={{ fontSize: 12, opacity: 0.8 }}>{n.written_by_name}</span>}
                      {n.unread && (
                        <button
                          type="button"
                          onClick={() => markReadMutation.mutate(n.handover_id)}
                          disabled={markReadMutation.isPending}
                          className="cal-focus"
                          style={{ marginLeft: "auto", height: 32, padding: "0 12px", borderRadius: 10, border: "none", background: "var(--cal-surface)", color: "var(--cal-ink)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Check className="h-4 w-4" /> Mark read
                        </button>
                      )}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 2, fontSize: 14, color: "var(--cal-ink)" }}>
                      {n.items.map((it) => (
                        <li key={it.id}>
                          {it.text}
                          {it.show_until && (
                            <span style={{ fontSize: 12, color: "var(--cal-muted)" }}>
                              {" "}· until {new Date(`${it.show_until}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>
          )}

          {/* ── Phone: this week on the watch calendar (tap to open it) ───────── */}
          {isPhone && watchName !== "Watch" && (
            <TaskWeekStrip watch={watchName} tasks={tasks} selectedDay={selectedDay} onPickDay={setSelectedDay} onOpenTask={setSelectedTask} />
          )}

          {/* ── Counts ─────────────────────────────────────────────────────── */}
          {viewMode === "board" && !isPhone && (
            <div role="group" aria-label="Task counts" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {stats.map((st) => {
                const filled = st.over && st.value > 0;
                const style: React.CSSProperties = {
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: "12px 14px", borderRadius: 16,
                  font: "inherit", textAlign: "left",
                  ...(filled
                    ? { background: "var(--cal-day-bg)", color: "var(--cal-day-fg)", border: "1px solid transparent" }
                    : { background: "var(--cal-surface)", color: "var(--cal-ink)", border: "1px solid var(--cal-line)", boxShadow: "var(--cal-shadow)" }),
                };
                const body = (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", opacity: 0.85 }}>{st.label}</span>
                    <span className="cal-mono" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1 }}>{st.value}</span>
                  </>
                );
                return st.over ? (
                  <button
                    key={st.key}
                    type="button"
                    aria-pressed={filterOverdue}
                    aria-label={`${st.label}: ${st.value}. ${filterOverdue ? "Show all tasks" : "Show only overdue tasks"}`}
                    onClick={() => setFilterOverdue(!filterOverdue)}
                    className="cal-focus"
                    style={{ ...style, cursor: "pointer", ...(filterOverdue ? { boxShadow: "0 0 0 2px var(--cal-day-dot)" } : {}) }}
                  >
                    {body}
                  </button>
                ) : (
                  <div key={st.key} style={style}>{body}</div>
                );
              })}
            </div>
          )}

          {/* ── Filters (desktop board) ────────────────────────────────────── */}
          {viewMode === "board" && !isPhone && (
            <section aria-label="Filters" className="cal-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <label style={{ flex: "1 1 240px", display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", borderRadius: 12, background: "var(--cal-surface-2)", color: "var(--cal-muted)" }}>
                  <Search className="h-4 w-4" />
                  <input
                    aria-label="Search tasks"
                    placeholder="Search tasks…"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", font: "inherit", fontSize: 14, color: "var(--cal-ink)", outline: "none" }}
                  />
                </label>
                {people.length > 0 && (
                  <div role="group" aria-label="Filter by person" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      aria-pressed={!filterAssignee}
                      onClick={() => setFilterAssignee("")}
                      className="cal-focus"
                      style={{
                        height: 32, padding: "0 10px", borderRadius: 9, border: "none", font: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        ...(!filterAssignee ? { background: "var(--cal-ink)", color: "var(--cal-surface)" } : { background: "var(--cal-surface-2)", color: "var(--cal-ink-2)" }),
                      }}
                    >
                      All
                    </button>
                    {people.map((p) => personButton(p, 32))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                {TASK_LABELS.map((label) => {
                  const on = filterLabels.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLabel(label.id)}
                      className="cal-focus"
                      style={{
                        height: 32, padding: "0 11px", borderRadius: 999, font: "inherit", fontSize: 13, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 6,
                        ...(on
                          ? { background: `var(--lb-${label.id}-bg)`, color: `var(--lb-${label.id}-fg)`, border: `1px solid ${label.colour}`, fontWeight: 600 }
                          : { background: "var(--cal-surface)", color: "var(--cal-ink)", border: "1px solid var(--cal-line-2)", fontWeight: 500 }),
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: label.colour }} />
                      {label.name}
                    </button>
                  );
                })}
                <span style={{ width: 1, height: 20, background: "var(--cal-line-2)", margin: "0 4px" }} />
                <button
                  type="button"
                  aria-pressed={filterOverdue}
                  onClick={() => setFilterOverdue(!filterOverdue)}
                  className="cal-focus"
                  style={{
                    height: 32, padding: "0 11px", borderRadius: 999, font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    color: "var(--cal-station-fg)",
                    ...(filterOverdue
                      ? { background: "var(--cal-station-bg)", border: "1px solid var(--cal-station-dot)" }
                      : { background: "transparent", border: "1px dashed var(--cal-station-dot)" }),
                  }}
                >
                  Overdue only
                </button>
                <button
                  type="button"
                  disabled={!hasActiveFilters}
                  onClick={clearFilters}
                  className="cal-focus"
                  style={{ height: 32, padding: "0 8px", border: "none", background: "transparent", color: "var(--cal-muted)", font: "inherit", fontSize: 13, fontWeight: 500, cursor: hasActiveFilters ? "pointer" : "default", opacity: hasActiveFilters ? 1 : 0.6 }}
                >
                  Clear
                </button>
              </div>
            </section>
          )}

          {/* ── Board / List ─────────────────────────────────────────────────── */}
          {viewMode === "board" ? (
            <section
              aria-label="Board"
              style={isPhone ? undefined : {
                background: bgId === "default" ? "var(--cal-board)" : isDark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.35)",
                borderRadius: 24, padding: 16, overflowX: "auto",
              }}
            >
              <TaskBoard
                tasks={shiftTasks}
                isLoading={shiftLoading}
                shiftStart={shift?.start}
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
            </section>
          ) : (
            <TaskList
              tasks={tasks}
              isLoading={isLoading}
              onTaskClick={setSelectedTask}
            />
          )}
        </main>

        {/* ════════════════ Watch calendar (desktop) ════════════════ */}
        {!isPhone && watchName !== "Watch" && (
          <div style={{ flex: "1 1 300px", maxWidth: 330, minWidth: 0 }}>
            <TaskSidePanel watch={watchName} tasks={tasks} selectedDay={selectedDay} onPickDay={setSelectedDay} onOpenTask={setSelectedTask} />
          </div>
        )}
      </div>

      {/* ── Phone: Create Task button above the bottom bar ─────────────────── */}
      {isPhone && (
        <button
          type="button"
          onClick={handleNewTask}
          className="cal-focus"
          style={{
            position: "fixed", right: 16, bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 40,
            height: 52, padding: "0 8px 0 20px", borderRadius: 999, border: "none", background: "var(--cal-brand)", color: "#fff",
            font: "inherit", fontSize: 15, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer",
            boxShadow: "0 10px 24px rgba(67,56,202,.4)",
          }}
        >
          Create Task
          <span style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,.22)", display: "grid", placeItems: "center" }}>
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} />
          </span>
        </button>
      )}

      {/* ── Phone: filter sheet ────────────────────────────────────────────── */}
      {isPhone && showFilterSheet && (
        <FilterSheet onClose={() => setShowFilterSheet(false)} onClear={clearFilters}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, height: 48, padding: "0 14px", borderRadius: 14, background: "var(--cal-surface-2)", color: "var(--cal-muted)" }}>
            <Search className="h-[18px] w-[18px]" />
            <input
              aria-label="Search tasks"
              placeholder="Search tasks…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", font: "inherit", fontSize: 16, color: "var(--cal-ink)", outline: "none" }}
            />
          </label>
          <span style={sheetCaption}>Labels</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
            {TASK_LABELS.map((label) => {
              const on = filterLabels.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLabel(label.id)}
                  className="cal-focus"
                  style={{
                    height: 44, borderRadius: 12, font: "inherit", fontSize: 14, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", cursor: "pointer", color: "var(--cal-ink)",
                    ...(on ? { border: "2px solid var(--cal-ink)", background: "var(--cal-surface-2)", fontWeight: 600 } : { border: "1px solid var(--cal-line-2)", background: "var(--cal-surface)" }),
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: label.colour }} />
                  {label.name}
                  {on && <Check className="h-[15px] w-[15px]" strokeWidth={2.6} style={{ marginLeft: "auto" }} />}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Overdue only</span>
            <button
              type="button"
              role="switch"
              aria-checked={filterOverdue}
              aria-label="Overdue only"
              onClick={() => setFilterOverdue(!filterOverdue)}
              className="cal-focus"
              style={{ width: 52, height: 32, borderRadius: 999, border: "none", position: "relative", padding: 0, cursor: "pointer", background: filterOverdue ? "var(--cal-brand)" : "var(--cal-surface-3)", transition: "background .15s" }}
            >
              <span style={{ position: "absolute", top: 3, left: filterOverdue ? 23 : 3, width: 26, height: 26, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .15s" }} />
            </button>
          </div>
          {people.length > 0 && (
            <>
              <span style={sheetCaption}>Person</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{people.map((p) => personButton(p, 44))}</div>
            </>
          )}
        </FilterSheet>
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

const sheetCaption: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--cal-muted)", letterSpacing: ".06em", textTransform: "uppercase" };

/** Phone bottom sheet holding the board filters. */
function FilterSheet({ onClose, onClear, children }: { onClose: () => void; onClear: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="cal-ui" style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,12,24,.45)" }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "90vh", overflowY: "auto", background: "var(--cal-surface)",
          borderRadius: "28px 28px 0 0", padding: "10px 18px calc(20px + env(safe-area-inset-bottom))",
          display: "flex", flexDirection: "column", gap: 14, boxShadow: "var(--cal-pop)",
        }}
      >
        <span aria-hidden style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, background: "var(--cal-line-2)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Filters</h2>
          <button type="button" onClick={onClear} className="cal-focus" style={{ height: 40, padding: "0 10px", border: "none", background: "transparent", color: "var(--cal-brand-text)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Clear
          </button>
        </div>
        {children}
        <button
          type="button"
          onClick={onClose}
          className="cal-focus"
          style={{ height: 52, borderRadius: 14, border: "none", background: "var(--cal-brand)", color: "#fff", font: "inherit", fontSize: 16, fontWeight: 600, marginTop: 4, cursor: "pointer" }}
        >
          Done
        </button>
      </section>
    </div>,
    document.body
  );
}
