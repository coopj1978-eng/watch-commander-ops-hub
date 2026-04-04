import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Plus, Repeat, Search, Palette, X as XIcon, CheckSquare } from "lucide-react";
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
    queryFn: async () => (await backend.profile.list()).profiles ?? [],
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

  // Dynamic text colours for dark backgrounds
  const headingClass = isDark ? "text-white" : "text-foreground";
  const subtitleClass = isDark ? "text-white/60" : "text-muted-foreground";
  const btnOutlineClass = isDark
    ? "bg-white/15 text-white border-white/25 hover:bg-white/25"
    : "";

  return (
    <div
      className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 space-y-5 transition-all duration-500"
      style={bgId !== "default" ? { background: bg.style.replace("background: ", "") } : {}}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold flex items-center gap-3 ${headingClass}`}>
            <CheckSquare className={`h-7 w-7 shrink-0 ${isDark ? "text-white/80" : "text-blue-500"}`} />
            Tasks
          </h1>
          <p className={`mt-1 ${subtitleClass}`}>
            {watchName} Tasks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Board/List toggle */}
          <Button variant="outline" size="icon" onClick={() => setViewMode("board")} title="Board view"
            className={`${viewMode === "board" ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700" : btnOutlineClass}`}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setViewMode("list")} title="List view"
            className={`${viewMode === "list" ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700" : btnOutlineClass}`}>
            <List className="h-4 w-4" />
          </Button>

          {/* Background picker */}
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowBgPicker(!showBgPicker)}
              title="Board background"
              className={`${showBgPicker ? "bg-indigo-600 text-white border-indigo-600" : btnOutlineClass}`}
            >
              <Palette className="h-4 w-4" />
            </Button>
            {showBgPicker && (
              <div className={`absolute right-0 top-11 z-50 rounded-2xl shadow-2xl border p-4 w-72 ${isDark ? "bg-gray-900/95 border-white/10" : "bg-white border-border"}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-semibold ${isDark ? "text-white" : ""}`}>Board Background</span>
                  <button onClick={() => setShowBgPicker(false)} className={isDark ? "text-white/50 hover:text-white" : "text-muted-foreground hover:text-foreground"}>
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {BOARD_BACKGROUNDS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => handleBgChange(b.id)}
                      className={`h-12 rounded-xl transition-all hover:scale-105 border-2 ${bgId === b.id ? "border-indigo-500 scale-105 shadow-lg" : "border-transparent"}`}
                      style={{ background: b.style.replace("background: ", "") }}
                      title={b.name}
                    />
                  ))}
                </div>
                <p className={`text-xs mt-3 text-center ${isDark ? "text-white/40" : "text-muted-foreground"}`}>Click to apply</p>
              </div>
            )}
          </div>

          <Button variant="outline" className={`ml-1 ${btnOutlineClass}`} onClick={() => setShowTemplateManager(true)}>
            <Repeat className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleNewTask}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* ── Filter Bar (board only) ─────────────────────────────────────────── */}
      {viewMode === "board" && (
        <div className={`flex flex-wrap items-center gap-2 p-3 rounded-2xl border ${
          isDark ? "bg-black/20 border-white/10 backdrop-blur-sm" : "bg-white/70 border-border backdrop-blur-sm shadow-sm"
        }`}>
          {/* Search */}
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isDark ? "text-white/40" : "text-muted-foreground"}`} />
            <input
              className={`w-full h-8 pl-7 pr-3 rounded-lg text-sm border outline-none ${
                isDark
                  ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/40"
                  : "bg-background border-border focus:border-indigo-400"
              }`}
              placeholder="Search tasks…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>

          {/* Label filters — hidden on mobile to save space */}
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
            {TASK_LABELS.map((label) => {
              const active = filterLabels.includes(label.id);
              return (
                <button
                  key={label.id}
                  onClick={() => setFilterLabels(active ? filterLabels.filter((l) => l !== label.id) : [...filterLabels, label.id])}
                  className={`h-6 px-2.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? "text-white border-transparent shadow-sm scale-105"
                      : isDark
                        ? "bg-white/10 text-white/60 border-white/20 hover:text-white"
                        : "bg-muted/60 text-muted-foreground border-border hover:text-white"
                  }`}
                  style={active ? { backgroundColor: label.colour } : {}}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = label.colour; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
                  onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""; (e.currentTarget as HTMLButtonElement).style.color = ""; } }}
                >
                  {label.name}
                </button>
              );
            })}
          </div>

          {/* Overdue toggle — hidden on mobile */}
          <button
            onClick={() => setFilterOverdue(!filterOverdue)}
            className={`hidden sm:inline-flex h-7 px-3 rounded-full text-xs font-medium border transition-all ${
              filterOverdue
                ? "bg-red-500 text-white border-red-500"
                : isDark
                  ? "bg-white/10 text-white/60 border-white/20 hover:bg-red-500/30 hover:text-red-300"
                  : "bg-muted/60 text-muted-foreground border-border hover:bg-red-50 hover:text-red-500 hover:border-red-300"
            }`}
          >
            Overdue only
          </button>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterSearch(""); setFilterLabels([]); setFilterOverdue(false); setFilterAssignee(""); }}
              className={`h-7 w-7 flex items-center justify-center rounded-full transition-all ${
                isDark ? "text-white/40 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="Clear filters"
            >
              <XIcon className="h-3.5 w-3.5" />
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
