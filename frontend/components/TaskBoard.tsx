import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Check, X, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import TaskCard from "./TaskCard";
import QuickAddCard from "./QuickAddCard";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import type { Task, TaskColumn } from "~backend/task/types";

interface TaskBoardFilters {
  search: string;
  labels: string[];
  overdueOnly: boolean;
  assignee: string;
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
}

function EditableColumnHeader({
  column,
  canEdit,
  onRename,
  onDelete,
  allCount,
  wipLimit,
  editingWip,
  wipValue,
  onStartEditWip,
  onSaveWip,
  onChangeWip,
  onCancelWip,
  isCollapsed,
  onToggleCollapse,
  isDark,
}: {
  column: TaskColumn;
  canEdit: boolean;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  allCount: number;
  wipLimit?: number;
  editingWip: boolean;
  wipValue: string;
  onStartEditWip: () => void;
  onSaveWip: () => void;
  onChangeWip: (v: string) => void;
  onCancelWip: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isDark: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(column.name);
  const isOverWip = wipLimit !== undefined && allCount > wipLimit;
  const iconBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: "var(--cal-muted)",
    display: "grid", placeItems: "center", cursor: "pointer", padding: 0,
  };

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== column.name) onRename(column.id, trimmed);
    setEditing(false);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        {editing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <input
              aria-label="Column name"
              className="cal-field"
              style={{ flex: 1, height: 32 }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(column.name); setEditing(false); } }}
              onBlur={handleSave}
              autoFocus
            />
            <button type="button" aria-label="Save" onClick={handleSave} style={{ ...iconBtn, color: "var(--cal-leave-dot)" }}><Check className="h-4 w-4" /></button>
            <button type="button" aria-label="Cancel" onClick={() => { setValue(column.name); setEditing(false); }} style={iconBtn}><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <>
            <div
              style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, cursor: canEdit ? "pointer" : undefined }}
              onDoubleClick={() => canEdit && setEditing(true)}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", flex: "none", background: column.color }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--cal-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {column.name}
              </span>
              <span
                className="cal-mono"
                style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 999, flex: "none",
                  ...(isOverWip
                    ? { background: "var(--cal-station-bg)", color: "var(--cal-station-fg)" }
                    : { background: "var(--cal-surface)", color: "var(--cal-ink-2)", border: "1px solid var(--cal-line)" }),
                }}
                title={isOverWip ? "Over the WIP limit" : undefined}
              >
                {allCount}{wipLimit ? `/${wipLimit}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {canEdit && (
                <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" style={{ display: "flex", gap: 2 }}>
                  <button type="button" style={iconBtn} onClick={() => setEditing(true)} title="Rename" aria-label={`Rename ${column.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" style={iconBtn} onClick={() => onDelete(column.id)} title="Delete" aria-label={`Delete ${column.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={onToggleCollapse}
                style={iconBtn}
                title={isCollapsed ? "Expand column" : "Collapse column"}
                aria-label={isCollapsed ? `Expand ${column.name}` : `Collapse ${column.name}`}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </>
        )}
      </div>

      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 18, marginTop: 2 }}>
          {editingWip ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                aria-label="WIP limit"
                className="cal-field cal-mono"
                style={{ width: 64, height: 28, fontSize: 12 }}
                placeholder="limit"
                value={wipValue}
                onChange={(e) => onChangeWip(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onSaveWip(); if (e.key === "Escape") onCancelWip(); }}
                autoFocus
              />
              <button type="button" aria-label="Save limit" onClick={onSaveWip} style={{ ...iconBtn, color: "var(--cal-leave-dot)" }}><Check className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label="Cancel" onClick={onCancelWip} style={iconBtn}><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartEditWip}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cal-mono"
              style={{ border: "none", background: "transparent", color: "var(--cal-muted)", fontSize: 11, cursor: "pointer", padding: 0 }}
              title="Set a work-in-progress limit"
            >
              {wipLimit ? `WIP ${wipLimit}` : "Set limit"}
            </button>
          )}
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
  const [editingWip, setEditingWip] = useState<string | null>(null);
  const [wipValue, setWipValue] = useState("");

  const saveWip = (key: string) => {
    const n = parseInt(wipValue);
    const next = { ...wipLimits };
    if (isNaN(n) || n <= 0) delete next[key]; else next[key] = n;
    setWipLimits(next);
    localStorage.setItem("task-wip-limits", JSON.stringify(next));
    setEditingWip(null);
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
    mutationFn: async (params: { id: number; status?: string; position?: number }) => { const { id, ...rest } = params; return backend.task.update(id, rest); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
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

  // ── Filter tasks ────────────────────────────────────────────────────────────
  const visibleTasks = tasks.filter((t) => {
    if (!filters) return true;
    if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.labels.length > 0 && !filters.labels.some((l) => (t.tags ?? []).includes(l))) return false;
    if (filters.overdueOnly) {
      if (!t.due_at || new Date(t.due_at) > new Date() || t.status === "Done") return false;
    }
    if (filters.assignee && t.assigned_to_user_id !== filters.assignee) return false;
    return true;
  });

  // Group + sort tasks per column
  const tasksByColumn: Record<string, Task[]> = {};
  const allTasksByColumn: Record<string, Task[]> = {};
  for (const col of columns) {
    tasksByColumn[col.status_key] = visibleTasks.filter((t) => t.status === col.status_key).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    allTasksByColumn[col.status_key] = tasks.filter((t) => t.status === col.status_key);
  }

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
    let newPosition: number;
    if (dragOverTaskId !== null && dragOverTaskId !== draggedTask.id) {
      const overIdx = colTasks.findIndex((t) => t.id === dragOverTaskId);
      if (overIdx === -1) newPosition = (colTasks[colTasks.length - 1]?.position ?? 0) + 1;
      else {
        const before = colTasks[overIdx - 1]?.position ?? (colTasks[overIdx].position ?? 0) - 1;
        newPosition = (before + (colTasks[overIdx]?.position ?? 0)) / 2;
      }
    } else {
      newPosition = (colTasks[colTasks.length - 1]?.position ?? 0) + 1;
    }

    updateTaskMutation.mutate({ id: draggedTask.id, position: newPosition, status: colKey });
    if (draggedTask.status !== colKey) {
      onStatusChange?.(draggedTask.id, colKey);
      // Cascade: if inspection task, invalidate related queries
      if ((draggedTask as any).source_type) {
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
          description: `${draggedTask.title} — targets updated.`,
        });
      }
    }
    setDraggedTask(null); setDragOverColKey(null); setDragOverTaskId(null);
  };

  if (isLoading && columns.length === 0) {
    return (
      <div className="flex gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-[80vw] sm:w-72 shrink-0" style={{ borderRadius: 20 }} />)}
      </div>
    );
  }

  // v2 design: each column is a soft card (surface-2) holding white task
  // cards; the column's own colour shows as a dot + count pill.
  const colBox: React.CSSProperties = {
    background: "var(--cal-surface-2)", border: "1px solid var(--cal-line)", borderRadius: 20,
    boxShadow: "var(--cal-shadow)",
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start">
      {columns.map((col) => {
        const colTasks = tasksByColumn[col.status_key] ?? [];
        const allColTasks = allTasksByColumn[col.status_key] ?? [];
        const isDropTarget = dragOverColKey === col.status_key && draggedTask?.status !== col.status_key && dragOverTaskId === null;
        const isCollapsed = collapsedCols.has(col.status_key);
        const wipLimit = wipLimits[col.status_key];

        // ── Collapsed column — slim vertical strip ──────────────────────────
        if (isCollapsed) {
          return (
            <button
              key={col.id}
              type="button"
              className="shrink-0 cal-focus"
              onClick={() => toggleCollapse(col.status_key)}
              title={`Expand ${col.name}`}
              style={{ ...colBox, width: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 0", cursor: "pointer", font: "inherit", color: "var(--cal-ink-2)" }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
              <span style={{ fontSize: 13, fontWeight: 600, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{col.name}</span>
              <span className="cal-mono" style={{ fontSize: 12, color: "var(--cal-muted)" }}>{allColTasks.length}</span>
            </button>
          );
        }

        return (
          <div
            key={col.id}
            className="shrink-0 w-[80vw] sm:w-72 group"
            onDragOver={(e) => handleColDragOver(e, col.status_key)}
            onDrop={(e) => handleDrop(e, col.status_key)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverColKey(null); setDragOverTaskId(null); }
            }}
          >
            <section
              aria-label={col.name}
              style={{
                ...colBox, display: "flex", flexDirection: "column",
                ...(isDropTarget ? { boxShadow: "0 0 0 2px var(--cal-brand), var(--cal-shadow)" } : {}),
              }}
            >
              <div style={{ padding: "14px 14px 10px" }}>
                <EditableColumnHeader
                  column={col}
                  canEdit={canManageColumns}
                  onRename={(id, name) => updateColumnMutation.mutate({ id, name })}
                  onDelete={handleDeleteColumn}
                  allCount={allColTasks.length}
                  wipLimit={wipLimit}
                  editingWip={editingWip === col.status_key}
                  wipValue={wipValue}
                  onStartEditWip={() => { setEditingWip(col.status_key); setWipValue(wipLimit?.toString() ?? ""); }}
                  onSaveWip={() => saveWip(col.status_key)}
                  onChangeWip={setWipValue}
                  onCancelWip={() => setEditingWip(null)}
                  isCollapsed={false}
                  onToggleCollapse={() => toggleCollapse(col.status_key)}
                  isDark={false}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 10px 12px", minHeight: 60 }}>
                {isLoading ? (
                  [...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full" style={{ borderRadius: 14 }} />)
                ) : (
                  <>
                    {colTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleTaskDragOver(e, task.id)}
                        style={{
                          opacity: draggedTask?.id === task.id ? 0.3 : 1,
                          transition: "opacity .15s",
                          borderRadius: 14,
                          cursor: canEdit ? "grab" : undefined,
                          ...(dragOverTaskId === task.id && draggedTask?.id !== task.id ? { boxShadow: "0 -3px 0 var(--cal-brand)" } : {}),
                        }}
                      >
                        <TaskCard
                          task={task}
                          onClick={() => onTaskClick?.(task)}
                          onChecklistToggle={onChecklistToggle}
                          onTitleEdit={canEdit ? onTitleEdit : undefined}
                          isDark={isDark}
                          userMap={userMap}
                        />
                      </div>
                    ))}

                    {colTasks.length === 0 && !isDropTarget && (
                      <div style={{ textAlign: "center", padding: "22px 0", fontSize: 13, color: "var(--cal-muted)", border: "2px dashed var(--cal-line-2)", borderRadius: 14 }}>
                        No tasks
                      </div>
                    )}

                    {isDropTarget && (
                      <div style={{ textAlign: "center", padding: "16px 0", fontSize: 13, fontWeight: 600, color: "var(--cal-brand-text)", border: "2px dashed var(--cal-brand)", background: "var(--cal-brand-soft)", borderRadius: 14 }}>
                        Drop here
                      </div>
                    )}

                    {canEdit && (
                      <QuickAddCard
                        columnStatusKey={col.status_key}
                        onAdd={(title, statusKey) => onTaskCreate?.(title, statusKey)}
                      />
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        );
      })}

      {/* Add Column */}
      {canManageColumns && (
        <div className="shrink-0 w-[80vw] sm:w-72">
          {addingColumn ? (
            <div style={{ ...colBox, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
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
                width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 20,
                border: "2px dashed var(--cal-line-2)", background: "transparent", color: isDark ? "#fff" : "var(--cal-ink-2)",
                font: "inherit", fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}
            >
              <Plus className="h-4 w-4" /> Add column
            </button>
          )}
        </div>
      )}
    </div>
  );
}
