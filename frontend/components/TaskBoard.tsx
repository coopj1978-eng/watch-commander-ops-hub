import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Check, X, ChevronsLeft, ChevronsRight, MoreHorizontal } from "lucide-react";
import TaskCard from "./TaskCard";
import QuickAddCard from "./QuickAddCard";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useIsPhone } from "@/lib/taskUi";
import type { Task, TaskColumn, TaskPriority } from "~backend/task/types";

interface TaskBoardFilters {
  search: string;
  labels: string[];
  overdueOnly: boolean;
  assignee: string;
  /** Only tasks due on this day (YYYY-MM-DD), from the watch calendar panel. */
  dueOn?: string;
}

interface TaskBoardProps {
  tasks: Task[];
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
  onChecklistToggle?: (taskId: number, itemId: string, completed: boolean) => void;
  onStatusChange?: (taskId: number, newStatus: string) => void;
  onTaskCreate?: (title: string, statusKey: string) => void;
  onTitleEdit?: (taskId: number, newTitle: string) => void;
  canEdit?: boolean;
  canManageColumns?: boolean;
  filters?: TaskBoardFilters;
  isDark?: boolean;
  userMap?: Record<string, { initials: string; colour: string }>;
  /** Start of the shift shown — earlier unfinished cards are tagged "Carried from …". */
  shiftStart?: string;
}

const countPill: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 8, flex: "none",
  background: "var(--cal-surface-2)", color: "var(--cal-ink-2)",
};

/** Column header pill: dot, name, count (red when over the WIP limit), ⋯ menu (WC/CC), collapse and quick-add "+". */
function ColumnHeader({
  column, count, shown, wipLimit, canManage, onRename, onDelete, onSetWip, onCollapse, onQuickAdd,
}: {
  column: TaskColumn;
  count: number;
  /** Cards showing after filters; the pill reads "0 of 3" when some are hidden. */
  shown?: number;
  wipLimit?: number;
  canManage: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onSetWip: (limit: number | undefined) => void;
  /** Undefined on phones, where one column shows at a time. */
  onCollapse?: () => void;
  onQuickAdd?: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const [editingWip, setEditingWip] = useState(false);
  const [wip, setWip] = useState("");
  const isOverWip = wipLimit !== undefined && count > wipLimit;

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) onRename(trimmed);
    else setName(column.name);
    setRenaming(false);
  };
  const saveWip = () => {
    const n = parseInt(wip);
    onSetWip(isNaN(n) || n <= 0 ? undefined : n);
    setEditingWip(false);
  };
  const iconBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 9, border: "none", background: "transparent", color: "var(--cal-muted)",
    display: "grid", placeItems: "center", cursor: "pointer", padding: 0, flex: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, height: 52, padding: "0 8px 0 14px", borderRadius: 16,
          background: "var(--cal-surface)",
          boxShadow: isOverWip ? "var(--cal-shadow), inset 0 0 0 1.5px var(--cal-station-dot)" : "var(--cal-shadow)",
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: "50%", flex: "none", background: column.color }} />
        {renaming ? (
          <input
            aria-label="Column name"
            className="cal-field"
            style={{ flex: 1, minWidth: 0, height: 34 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(column.name); setRenaming(false); } }}
            onBlur={saveName}
            autoFocus
          />
        ) : (
          <span
            onDoubleClick={() => canManage && setRenaming(true)}
            style={{ fontSize: 15, fontWeight: 600, color: "var(--cal-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
          >
            {column.name}
          </span>
        )}
        {!renaming && (
          <span
            className="cal-mono"
            title={isOverWip ? "Over the work-in-progress limit" : undefined}
            style={isOverWip ? { ...countPill, background: "var(--cal-station-bg)", color: "var(--cal-station-fg)" } : countPill}
          >
            {shown !== undefined && shown < count ? `${shown} of ${count}` : `${count}${wipLimit ? `/${wipLimit}` : ""}`}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {!renaming && canManage && (
          <Menu.Root>
            <Menu.Trigger asChild>
              <button type="button" aria-label={`${column.name} column actions`} className="cal-focus" style={iconBtn}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} collisionPadding={12} className="cal-menu">
                <Menu.Item className="cal-menu-item" onSelect={() => setRenaming(true)}>Rename</Menu.Item>
                <Menu.Item className="cal-menu-item" onSelect={() => { setWip(wipLimit?.toString() ?? ""); setEditingWip(true); }}>
                  {wipLimit ? `Change WIP limit (${wipLimit})…` : "Set WIP limit…"}
                </Menu.Item>
                <Menu.Separator className="cal-menu-sep" />
                <Menu.Item className="cal-menu-item cal-menu-danger" onSelect={onDelete}>Delete column</Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        )}
        {!renaming && onCollapse && (
          <button type="button" aria-label={`Collapse ${column.name}`} title="Collapse column" onClick={onCollapse} className="cal-focus" style={{ ...iconBtn, width: 32, height: 32, borderRadius: 9 }}>
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
        {onQuickAdd && !renaming && (
          <button
            type="button"
            aria-label={`Add a card to ${column.name}`}
            title="Add a card"
            onClick={onQuickAdd}
            className="cal-focus"
            style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "var(--cal-brand-soft)", color: "var(--cal-brand-text)", display: "grid", placeItems: "center", cursor: "pointer", flex: "none", padding: 0 }}
          >
            <Plus className="h-[15px] w-[15px]" strokeWidth={2.6} />
          </button>
        )}

      </div>

      {isOverWip && (
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cal-station-fg)", padding: "0 6px", marginTop: -4 }}>
          Over WIP limit · {count} of {wipLimit}
        </span>
      )}

      {editingWip && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px" }}>
          <input
            aria-label="Work-in-progress limit"
            className="cal-field cal-mono"
            inputMode="numeric"
            style={{ width: 90, height: 34, fontSize: 12 }}
            placeholder="No limit"
            value={wip}
            onChange={(e) => setWip(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveWip(); if (e.key === "Escape") setEditingWip(false); }}
            autoFocus
          />
          <button type="button" aria-label="Save limit" onClick={saveWip} style={{ ...iconBtn, color: "var(--cal-leave-dot)" }}><Check className="h-4 w-4" /></button>
          <button type="button" aria-label="Cancel" onClick={() => setEditingWip(false)} style={iconBtn}><X className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

export default function TaskBoard({
  tasks,
  isLoading,
  onTaskClick,
  onChecklistToggle,
  onStatusChange,
  onTaskCreate,
  onTitleEdit,
  canEdit = false,
  canManageColumns = false,
  filters,
  isDark = false,
  userMap,
  shiftStart,
}: TaskBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: columnsData } = useQuery({
    queryKey: ["task-columns"],
    queryFn: async () => (await backend.task.listColumns()).columns,
  });
  const columns = (columnsData ?? []) as unknown as TaskColumn[];

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const isPhone = useIsPhone();
  const [phoneCol, setPhoneCol] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // ── Collapse state ─────────────────────────────────────────────────────────
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("task-collapsed-cols") ?? "[]")); }
    catch { return new Set(); }
  });

  const toggleCollapse = (key: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem("task-collapsed-cols", JSON.stringify([...next]));
      return next;
    });
  };

  // ── WIP limits ─────────────────────────────────────────────────────────────
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("task-wip-limits") ?? "{}"); }
    catch { return {}; }
  });

  const setWip = (key: string, limit: number | undefined) => {
    const next = { ...wipLimits };
    if (limit === undefined) delete next[key]; else next[key] = limit;
    setWipLimits(next);
    localStorage.setItem("task-wip-limits", JSON.stringify(next));
  };

  // ── Column mutations ────────────────────────────────────────────────────────
  const createColumnMutation = useMutation({
    mutationFn: async (name: string) => backend.task.createColumn({ name, status_key: name.replace(/\s+/g, "_") + "_" + Date.now() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-columns"] }),
    onError: () => toast({ title: "Error", description: "Failed to create column", variant: "destructive" }),
  });

  const updateColumnMutation = useMutation({
    mutationFn: async (params: { id: number; name?: string }) => { const { id, ...rest } = params; return backend.task.updateColumn(id, rest); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-columns"] }),
    onError: () => toast({ title: "Error", description: "Failed to rename column", variant: "destructive" }),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (id: number) => backend.task.deleteColumn(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["task-columns"] }); queryClient.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: () => toast({ title: "Error", description: "Failed to delete column", variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (params: { id: number; status?: string; position?: number; priority?: TaskPriority }) => {
      const { id, ...rest } = params;
      return backend.task.update(id, rest);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err: Error) => toast({ title: "Couldn't change the task", description: err.message, variant: "destructive" }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => backend.task.deleteTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err: Error) => toast({ title: "Couldn't delete the task", description: err.message, variant: "destructive" }),
  });

  const handleAddColumn = () => {
    const trimmed = newColName.trim();
    if (!trimmed) return;
    createColumnMutation.mutate(trimmed);
    setNewColName(""); setAddingColumn(false);
  };

  const handleDeleteColumn = (id: number) => {
    const col = columns.find((c) => c.id === id);
    const count = tasks.filter((t) => t.status === col?.status_key).length;
    if (confirm(count > 0
      ? `Delete "${col?.name}"? ${count} task${count !== 1 ? "s" : ""} will be moved to the first column.`
      : `Delete column "${col?.name}"?`
    )) deleteColumnMutation.mutate(id);
  };

  // Delete hides the card at once and only deletes after a few seconds, so Undo can bring it back.
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const handleDeleteTask = (task: Task) => {
    const restore = () => setDeletingIds((prev) => { const next = new Set(prev); next.delete(task.id); return next; });
    setDeletingIds((prev) => new Set(prev).add(task.id));
    const timer = setTimeout(() => deleteTaskMutation.mutate(task.id, { onError: restore }), 6000);
    toast({
      title: "Task deleted",
      description: task.title,
      action: <ToastAction altText="Undo delete" onClick={() => { clearTimeout(timer); restore(); }}>Undo</ToastAction>,
    });
  };

  // ── Filter tasks ────────────────────────────────────────────────────────────
  const liveTasks = tasks.filter((t) => !deletingIds.has(t.id));
  const visibleTasks = liveTasks.filter((t) => {
    if (!filters) return true;
    if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.labels.length > 0 && !filters.labels.some((l) => (t.tags ?? []).includes(l))) return false;
    if (filters.overdueOnly) {
      if (!t.due_at || new Date(t.due_at) > new Date() || t.status === "Done") return false;
    }
    if (filters.assignee && t.assigned_to_user_id !== filters.assignee) return false;
    if (filters.dueOn) {
      if (!t.due_at) return false;
      const d = new Date(t.due_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (key !== filters.dueOn) return false;
    }
    return true;
  });

  // Group + sort tasks per column
  const tasksByColumn: Record<string, Task[]> = {};
  const allTasksByColumn: Record<string, Task[]> = {};
  for (const col of columns) {
    tasksByColumn[col.status_key] = visibleTasks.filter((t) => t.status === col.status_key).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    allTasksByColumn[col.status_key] = liveTasks.filter((t) => t.status === col.status_key);
  }

  /** Put a task in a column at a position — shared by drag-and-drop and the card's ⋯ menu. */
  const moveTask = (task: Task, colKey: string, position?: number) => {
    const colTasks = tasksByColumn[colKey] ?? [];
    const newPosition = position ?? (colTasks[colTasks.length - 1]?.position ?? 0) + 1;
    updateTaskMutation.mutate({ id: task.id, position: newPosition, status: colKey });
    if (task.status !== colKey) {
      onStatusChange?.(task.id, colKey);
      // Cascade: if inspection task, invalidate related queries
      if ((task as any).source_type) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["hfsv"] });
          queryClient.invalidateQueries({ queryKey: ["hfsv-pending"] });
          queryClient.invalidateQueries({ queryKey: ["inspection-assignments-pending"] });
          queryClient.invalidateQueries({ queryKey: ["inspection-assignments"] });
          queryClient.invalidateQueries({ queryKey: ["targets"] });
          queryClient.invalidateQueries({ queryKey: ["activity"] });
        }, 500);
        const isDone = colKey === "Done";
        toast({
          title: isDone ? "Inspection complete" : "Inspection reverted",
          description: `${task.title} — targets updated.`,
        });
      }
    }
  };

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (!canEdit) return;
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => { setDraggedTask(null); setDragOverColKey(null); setDragOverTaskId(null); };

  const handleColDragOver = (e: React.DragEvent, colKey: string) => {
    if (!canEdit || !draggedTask) return;
    e.preventDefault();
    setDragOverColKey(colKey);
  };

  const handleTaskDragOver = (e: React.DragEvent, taskId: number) => {
    e.preventDefault(); e.stopPropagation();
    setDragOverTaskId(taskId);
  };

  const handleDrop = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (!canEdit || !draggedTask) return;
    const colTasks = tasksByColumn[colKey] ?? [];
    let newPosition: number | undefined;
    if (dragOverTaskId !== null && dragOverTaskId !== draggedTask.id) {
      const overIdx = colTasks.findIndex((t) => t.id === dragOverTaskId);
      if (overIdx !== -1) {
        const before = colTasks[overIdx - 1]?.position ?? (colTasks[overIdx].position ?? 0) - 1;
        newPosition = (before + (colTasks[overIdx]?.position ?? 0)) / 2;
      }
    }
    moveTask(draggedTask, colKey, newPosition);
    setDraggedTask(null); setDragOverColKey(null); setDragOverTaskId(null);
  };

  // ── Cards for one column (shared by the desktop board and the phone view) ──
  const renderColumnBody = (col: TaskColumn, colTasks: Task[], isDropTarget: boolean) =>
    isLoading ? (
      [...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 w-full" style={{ borderRadius: 16 }} />)
    ) : (
      <>
        {colTasks.map((task) => (
          <div
            key={task.id}
            draggable={canEdit && !isPhone}
            onDragStart={(e) => handleDragStart(e, task)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleTaskDragOver(e, task.id)}
            style={{
              borderRadius: 16,
              cursor: canEdit && !isPhone ? "grab" : undefined,
              transition: "opacity .15s, box-shadow .15s",
              ...(draggedTask?.id === task.id ? { opacity: 0.45, boxShadow: "0 0 0 2px var(--cal-brand)" } : {}),
              ...(dragOverTaskId === task.id && draggedTask?.id !== task.id ? { boxShadow: "0 -4px 0 var(--cal-brand)" } : {}),
            }}
          >
            <TaskCard
              task={task}
              onClick={() => onTaskClick?.(task)}
              onChecklistToggle={onChecklistToggle}
              onTitleEdit={canEdit ? onTitleEdit : undefined}
              isDark={isDark}
              userMap={userMap}
              columns={canEdit ? columns : undefined}
              columnCounts={columnCounts}
              onMove={canEdit ? (key) => moveTask(task, key) : undefined}
              onSetPriority={canEdit ? (priority) => updateTaskMutation.mutate({ id: task.id, priority }) : undefined}
              onDelete={canEdit ? () => handleDeleteTask(task) : undefined}
              shiftStart={shiftStart}
            />
          </div>
        ))}

        {colTasks.length === 0 && !isDropTarget && quickAddCol !== col.status_key && (
          <div style={{ textAlign: "center", padding: "22px 12px", fontSize: 13, color: "var(--cal-muted)", border: "2px dashed var(--cal-line-2)", borderRadius: 16 }}>
            {(allTasksByColumn[col.status_key] ?? []).length > 0
              ? `${(allTasksByColumn[col.status_key] ?? []).length} hidden by your filters`
              : "No tasks"}
          </div>
        )}

        {isDropTarget && (
          <div style={{ textAlign: "center", padding: "18px 0", fontSize: 12, fontWeight: 600, color: "var(--cal-brand-text)", border: "2px dashed var(--cal-brand)", background: "var(--cal-brand-soft)", borderRadius: 16 }}>
            Drop here
          </div>
        )}

        {canEdit && (
          <QuickAddCard
            columnStatusKey={col.status_key}
            onAdd={(title, statusKey) => onTaskCreate?.(title, statusKey)}
            open={quickAddCol === col.status_key}
            onOpenChange={(open) => setQuickAddCol(open ? col.status_key : null)}
          />
        )}
      </>
    );

  const columnCounts: Record<string, string> = {};
  for (const col of columns) {
    const n = (allTasksByColumn[col.status_key] ?? []).length;
    columnCounts[col.status_key] = wipLimits[col.status_key] ? `${n}/${wipLimits[col.status_key]}` : String(n);
  }

  if (isLoading && columns.length === 0) {
    return (
      <div className="flex gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full sm:w-[300px] shrink-0" style={{ borderRadius: 20 }} />)}
      </div>
    );
  }

  // ── Phone: one column at a time, picked with tabs (or a sideways swipe) ──
  if (isPhone) {
    const active = columns.find((c) => c.status_key === phoneCol) ?? columns[0];
    if (!active) return null;
    const activeIdx = columns.indexOf(active);
    const colTasks = tasksByColumn[active.status_key] ?? [];
    const go = (delta: number) => {
      const next = columns[activeIdx + delta];
      if (next) setPhoneCol(next.status_key);
    };
    const fewTabs = columns.length <= 3;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          role="tablist"
          aria-label="Columns"
          style={{
            padding: 4, borderRadius: 14, background: "var(--cal-surface-3)", gap: 4,
            ...(fewTabs
              ? { display: "grid", gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }
              : { display: "flex", overflowX: "auto" }),
          }}
        >
          {columns.map((c) => {
            const on = c.status_key === active.status_key;
            const n = (allTasksByColumn[c.status_key] ?? []).length;
            const over = wipLimits[c.status_key] !== undefined && n > wipLimits[c.status_key];
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPhoneCol(c.status_key)}
                className="cal-focus"
                style={{
                  height: 40, borderRadius: 10, border: "none", font: "inherit", fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 10px", whiteSpace: "nowrap",
                  ...(fewTabs ? {} : { flex: "1 0 auto" }),
                  ...(on
                    ? { background: "var(--cal-surface)", color: "var(--cal-ink)", fontWeight: 600, boxShadow: "var(--cal-shadow)" }
                    : { background: "transparent", color: "var(--cal-ink-2)", fontWeight: 500 }),
                }}
              >
                {c.name}
                <span
                  className="cal-mono"
                  style={{
                    fontSize: 11, padding: "1px 6px", borderRadius: 6,
                    ...(over ? { background: "var(--cal-station-bg)", color: "var(--cal-station-fg)", fontWeight: 600 } : { background: "var(--cal-surface-2)" }),
                  }}
                >
                  {columnCounts[c.status_key]}
                </span>
              </button>
            );
          })}
        </div>

        <section
          role="tabpanel"
          aria-label={active.name}
          style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 200 }}
          onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (!start) return;
            const dx = e.changedTouches[0].clientX - start.x;
            const dy = e.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
          }}
        >
          {wipLimits[active.status_key] !== undefined && colTasks.length > wipLimits[active.status_key] && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cal-station-fg)", padding: "0 6px" }}>
              Over WIP limit · {(allTasksByColumn[active.status_key] ?? []).length} of {wipLimits[active.status_key]}
            </span>
          )}
          {renderColumnBody(active, colTasks, false)}
        </section>
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-start" style={{ minWidth: "fit-content" }}>
      {columns.map((col) => {
        const colTasks = tasksByColumn[col.status_key] ?? [];
        const allColTasks = allTasksByColumn[col.status_key] ?? [];
        const isDropTarget = dragOverColKey === col.status_key && draggedTask?.status !== col.status_key && dragOverTaskId === null;
        const isCollapsed = collapsedCols.has(col.status_key);
        const wipLimit = wipLimits[col.status_key];

        // ── Collapsed column — slim tab; cards can still be dropped on it ──
        if (isCollapsed) {
          return (
            <button
              key={col.id}
              type="button"
              className="shrink-0 cal-focus"
              onClick={() => toggleCollapse(col.status_key)}
              onDragOver={(e) => handleColDragOver(e, col.status_key)}
              onDragLeave={() => setDragOverColKey(null)}
              onDrop={(e) => handleDrop(e, col.status_key)}
              aria-label={`${col.name}, ${allColTasks.length} cards, collapsed. Expand`}
              title={`Expand ${col.name}`}
              style={{
                width: 60, height: 420, borderRadius: 18, border: "none", background: "var(--cal-surface)",
                boxShadow: dragOverColKey === col.status_key ? "0 0 0 2px var(--cal-brand), var(--cal-shadow)" : "var(--cal-shadow)",
                color: "var(--cal-ink)", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center",
                gap: 12, padding: "16px 0", cursor: "pointer",
              }}
            >
              <ChevronsRight className="h-4 w-4" style={{ color: "var(--cal-muted)" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
              <span style={{ writingMode: "vertical-rl", fontSize: 15, fontWeight: 600 }}>{col.name}</span>
              <span className="cal-mono" style={{ ...countPill, padding: "3px 7px" }}>{allColTasks.length}</span>
            </button>
          );
        }

        return (
          <section
            key={col.id}
            aria-label={col.name}
            className="shrink-0"
            style={{ width: 300, display: "flex", flexDirection: "column", gap: 10 }}
            onDragOver={(e) => handleColDragOver(e, col.status_key)}
            onDrop={(e) => handleDrop(e, col.status_key)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverColKey(null); setDragOverTaskId(null); }
            }}
          >
            <ColumnHeader
              column={col}
              count={allColTasks.length}
              shown={colTasks.length}
              wipLimit={wipLimit}
              canManage={canManageColumns}
              onRename={(name) => updateColumnMutation.mutate({ id: col.id, name })}
              onDelete={() => handleDeleteColumn(col.id)}
              onSetWip={(limit) => setWip(col.status_key, limit)}
              onCollapse={() => toggleCollapse(col.status_key)}
              onQuickAdd={canEdit ? () => setQuickAddCol(col.status_key) : undefined}
            />
            {renderColumnBody(col, colTasks, isDropTarget)}
          </section>
        );
      })}

      {/* Add Column */}
      {canManageColumns && (
        <div className="shrink-0" style={{ width: addingColumn ? 300 : 200 }}>
          {addingColumn ? (
            <div style={{ background: "var(--cal-surface)", borderRadius: 16, boxShadow: "var(--cal-shadow)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                aria-label="Column name"
                placeholder="Column name…"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") { setAddingColumn(false); setNewColName(""); } }}
                autoFocus
                className="cal-field"
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="cal-focus"
                  style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "none", background: "var(--cal-brand)", color: "#fff", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Add column
                </button>
                <button type="button" aria-label="Cancel" className="cal-btn" style={{ width: 36, height: 36, padding: 0 }} onClick={() => { setAddingColumn(false); setNewColName(""); }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              className="cal-focus"
              style={{
                width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16,
                border: "2px dashed var(--cal-line-2)", background: "transparent", color: "var(--cal-ink-2)",
                font: "inherit", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} /> Add column
            </button>
          )}
        </div>
      )}
    </div>
  );
}
