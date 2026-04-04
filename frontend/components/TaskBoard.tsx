import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
  const mutedText = isDark ? "text-white/50" : "text-muted-foreground";

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== column.name) onRename(column.id, trimmed);
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-1 group">
        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              className="flex-1 text-sm font-semibold bg-transparent border-b border-foreground outline-none"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(column.name); setEditing(false); } }}
              onBlur={handleSave}
              autoFocus
            />
            <button onClick={handleSave} className="text-green-500"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setValue(column.name); setEditing(false); }} className={mutedText}><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <>
            <div
              className={`flex items-center gap-2 flex-1 min-w-0 ${canEdit ? "cursor-pointer" : ""}`}
              onDoubleClick={() => canEdit && setEditing(true)}
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
              <span className="text-sm font-semibold truncate" style={{ color: column.color }}>{column.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {canEdit && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className={`${mutedText} hover:text-foreground p-0.5 rounded`} onClick={() => setEditing(true)} title="Rename">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button className={`${mutedText} hover:text-red-500 p-0.5 rounded`} onClick={() => onDelete(column.id)} title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
              <button
                onClick={onToggleCollapse}
                className={`${mutedText} hover:text-foreground p-0.5 rounded transition-colors`}
                title={isCollapsed ? "Expand column" : "Collapse column"}
              >
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Count + WIP row */}
      <div className="flex items-center justify-between mt-0.5">
        <p className={`text-xs ${isOverWip ? "text-red-500 font-semibold" : mutedText}`}>
          {allCount}{wipLimit ? `/${wipLimit}` : ""} task{allCount !== 1 ? "s" : ""}
          {isOverWip && " ⚠"}
        </p>
        {canEdit && (
          editingWip ? (
            <div className="flex items-center gap-1">
              <input
                className="w-12 h-5 text-xs rounded border border-border px-1 bg-background outline-none"
                placeholder="limit"
                value={wipValue}
                onChange={(e) => onChangeWip(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onSaveWip(); if (e.key === "Escape") onCancelWip(); }}
                autoFocus
              />
              <button onClick={onSaveWip} className="text-green-500"><Check className="h-3 w-3" /></button>
              <button onClick={onCancelWip} className={mutedText}><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button
              onClick={onStartEditWip}
              className={`text-xs opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ${mutedText}`}
              title="Set WIP limit"
            >
              {wipLimit ? `WIP:${wipLimit}` : "set limit"}
            </button>
          )
        )}
      </div>
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
      <div className="flex gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-[66vw] sm:w-64 shrink-0 rounded-xl" />)}
      </div>
    );
  }

  const colCardClass = isDark
    ? "bg-black/30 backdrop-blur-sm border-white/10"
    : "bg-white/90 border-border";

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 items-start">
      {columns.map((col) => {
        const colTasks = tasksByColumn[col.status_key] ?? [];
        const allColTasks = allTasksByColumn[col.status_key] ?? [];
        const isDropTarget = dragOverColKey === col.status_key && draggedTask?.status !== col.status_key && dragOverTaskId === null;
        const isCollapsed = collapsedCols.has(col.status_key);
        const wipLimit = wipLimits[col.status_key];

        // ── Collapsed column — slim vertical strip ──────────────────────────
        if (isCollapsed) {
          return (
            <div
              key={col.id}
              className={`shrink-0 w-10 flex flex-col items-center rounded-xl border shadow-sm cursor-pointer hover:opacity-90 transition-all py-3 gap-2 ${colCardClass}`}
              onClick={() => toggleCollapse(col.status_key)}
              title={`Expand ${col.name}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
              <span
                className={`text-xs font-semibold ${isDark ? "text-white/80" : "text-muted-foreground"}`}
                style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
              >
                {col.name}
              </span>
              <span className={`text-xs font-mono ${isDark ? "text-white/50" : "text-muted-foreground"}`}>
                {allColTasks.length}
              </span>
            </div>
          );
        }

        return (
          <div
            key={col.id}
            className="shrink-0 w-[66vw] sm:w-64 group"
            onDragOver={(e) => handleColDragOver(e, col.status_key)}
            onDrop={(e) => handleDrop(e, col.status_key)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverColKey(null); setDragOverTaskId(null); }
            }}
          >
            <Card className={`flex flex-col transition-all rounded-xl ${isDropTarget ? "ring-2 ring-indigo-400 ring-offset-1" : ""} ${colCardClass}`}>
              <CardHeader
                className={`px-3 py-2.5 border-b ${isDark ? "border-white/10" : "border-border"} rounded-t-xl`}
                style={{ backgroundColor: col.color + "18" }}
              >
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
                  isDark={isDark}
                />
              </CardHeader>

              <CardContent className="flex flex-col gap-2 p-2 flex-1 min-h-[60px]">
                {isLoading ? (
                  [...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
                ) : (
                  <>
                    {colTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleTaskDragOver(e, task.id)}
                        className={[
                          "transition-opacity",
                          draggedTask?.id === task.id ? "opacity-30" : "opacity-100",
                          dragOverTaskId === task.id && draggedTask?.id !== task.id ? "ring-2 ring-indigo-400 rounded-xl" : "",
                          canEdit ? "cursor-move" : "",
                        ].join(" ")}
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
                      <div className={`text-center py-6 text-xs border-2 border-dashed rounded-xl ${isDark ? "border-white/20 text-white/40" : "border-border text-muted-foreground"}`}>
                        No tasks
                      </div>
                    )}

                    {isDropTarget && (
                      <div className="border-2 border-dashed border-indigo-400 rounded-xl py-4 text-center text-sm text-indigo-400 font-medium bg-indigo-500/10">
                        Drop here
                      </div>
                    )}

                    {canEdit && (
                      <div className="mt-0.5">
                        <QuickAddCard
                          columnStatusKey={col.status_key}
                          onAdd={(title, statusKey) => onTaskCreate?.(title, statusKey)}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}

      {/* Add Column */}
      {canManageColumns && (
        <div className="shrink-0 w-[66vw] sm:w-64">
          {addingColumn ? (
            <Card className={`p-3 space-y-2 rounded-xl ${colCardClass}`}>
              <input
                className="w-full text-sm border-b border-foreground bg-transparent outline-none pb-1 placeholder:text-muted-foreground"
                placeholder="Column name…"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") { setAddingColumn(false); setNewColName(""); } }}
                autoFocus
              />
              <div className="flex gap-2 items-center">
                <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleAddColumn}>Add column</Button>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => { setAddingColumn(false); setNewColName(""); }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ) : (
            <button
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border-2 border-dashed transition-colors ${
                isDark
                  ? "border-white/20 text-white/50 hover:text-white hover:border-white/40"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              onClick={() => setAddingColumn(true)}
            >
              <Plus className="h-4 w-4" /> Add column
            </button>
          )}
        </div>
      )}
    </div>
  );
}
