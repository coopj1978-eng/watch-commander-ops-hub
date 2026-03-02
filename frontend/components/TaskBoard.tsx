import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";
import TaskCard from "./TaskCard";
import QuickAddCard from "./QuickAddCard";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import type { Task, TaskColumn } from "~backend/task/types";

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
}

function EditableColumnHeader({
  column,
  canEdit,
  onRename,
  onDelete,
}: {
  column: TaskColumn;
  canEdit: boolean;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(column.name);

  const handleStartEdit = () => {
    if (!canEdit) return;
    setValue(column.name);
    setEditing(true);
  };

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== column.name) onRename(column.id, trimmed);
    setEditing(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setValue(column.name); setEditing(false); }
  };

  return (
    <div className="flex items-center justify-between gap-1 group">
      {editing ? (
        <div className="flex items-center gap-1 flex-1">
          <input
            className="flex-1 text-sm font-semibold bg-transparent border-b border-foreground outline-none"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            onBlur={handleSave}
            autoFocus
          />
          <button onClick={handleSave} className="text-green-500 hover:text-green-600">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setValue(column.name); setEditing(false); }} className="text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div
            className={`flex items-center gap-2 flex-1 min-w-0 ${canEdit ? "cursor-pointer" : ""}`}
            onDoubleClick={handleStartEdit}
            title={canEdit ? "Double-click to rename" : undefined}
          >
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
            <span className="text-sm font-semibold truncate" style={{ color: column.color }}>
              {column.name}
            </span>
          </div>
          {canEdit && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="text-muted-foreground hover:text-foreground p-0.5 rounded" onClick={handleStartEdit} title="Rename">
                <Pencil className="h-3 w-3" />
              </button>
              <button className="text-muted-foreground hover:text-red-500 p-0.5 rounded" onClick={() => onDelete(column.id)} title="Delete column">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </>
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
}: TaskBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: columnsData } = useQuery({
    queryKey: ["task-columns"],
    queryFn: async () => (await backend.task.listColumns()).columns,
  });
  const columns: TaskColumn[] = columnsData ?? [];

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState("");

  const createColumnMutation = useMutation({
    mutationFn: async (name: string) => {
      const statusKey = name.replace(/\s+/g, "_") + "_" + Date.now();
      return backend.task.createColumn({ name, status_key: statusKey });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-columns"] }),
    onError: () => toast({ title: "Error", description: "Failed to create column", variant: "destructive" }),
  });

  const updateColumnMutation = useMutation({
    mutationFn: async (params: { id: number; name?: string }) => {
      const { id, ...rest } = params;
      return backend.task.updateColumn(id, rest);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-columns"] }),
    onError: () => toast({ title: "Error", description: "Failed to rename column", variant: "destructive" }),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (id: number) => backend.task.deleteColumn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-columns"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete column", variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (params: { id: number; status?: string; position?: number }) => {
      const { id, ...rest } = params;
      return backend.task.update(id, rest);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const handleAddColumn = () => {
    const trimmed = newColName.trim();
    if (!trimmed) return;
    createColumnMutation.mutate(trimmed);
    setNewColName("");
    setAddingColumn(false);
  };

  const handleDeleteColumn = (id: number) => {
    const col = columns.find((c) => c.id === id);
    const count = tasks.filter((t) => t.status === col?.status_key).length;
    const msg = count > 0
      ? `Delete "${col?.name}"? ${count} task${count !== 1 ? "s" : ""} will be moved to the first column.`
      : `Delete column "${col?.name}"?`;
    if (confirm(msg)) deleteColumnMutation.mutate(id);
  };

  // Group + sort tasks per column
  const tasksByColumn: Record<string, Task[]> = {};
  for (const col of columns) {
    tasksByColumn[col.status_key] = tasks
      .filter((t) => t.status === col.status_key)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (!canEdit) return;
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColKey(null);
    setDragOverTaskId(null);
  };

  const handleColDragOver = (e: React.DragEvent, colKey: string) => {
    if (!canEdit || !draggedTask) return;
    e.preventDefault();
    setDragOverColKey(colKey);
  };

  const handleTaskDragOver = (e: React.DragEvent, taskId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTaskId(taskId);
  };

  const handleDrop = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (!canEdit || !draggedTask) return;

    const colTasks = tasksByColumn[colKey] ?? [];
    let newPosition: number;

    if (dragOverTaskId !== null && dragOverTaskId !== draggedTask.id) {
      const overIdx = colTasks.findIndex((t) => t.id === dragOverTaskId);
      if (overIdx === -1) {
        newPosition = (colTasks[colTasks.length - 1]?.position ?? 0) + 1;
      } else {
        const before = colTasks[overIdx - 1]?.position ?? (colTasks[overIdx].position ?? 0) - 1;
        const after = colTasks[overIdx]?.position ?? 0;
        newPosition = (before + after) / 2;
      }
    } else {
      newPosition = (colTasks[colTasks.length - 1]?.position ?? 0) + 1;
    }

    updateTaskMutation.mutate({ id: draggedTask.id, position: newPosition, status: colKey });
    if (draggedTask.status !== colKey) onStatusChange?.(draggedTask.id, colKey);

    setDraggedTask(null);
    setDragOverColKey(null);
    setDragOverTaskId(null);
  };

  if (isLoading && columns.length === 0) {
    return (
      <div className="flex gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-64 shrink-0 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start">
      {columns.map((col) => {
        const colTasks = tasksByColumn[col.status_key] ?? [];
        const isDropTarget = dragOverColKey === col.status_key && draggedTask?.status !== col.status_key && dragOverTaskId === null;

        return (
          <div
            key={col.id}
            className="shrink-0 w-64"
            onDragOver={(e) => handleColDragOver(e, col.status_key)}
            onDrop={(e) => handleDrop(e, col.status_key)}
            onDragLeave={(e) => {
              // Only clear if leaving the column entirely (not entering a child)
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverColKey(null);
                setDragOverTaskId(null);
              }
            }}
          >
            <Card className={`flex flex-col transition-all ${isDropTarget ? "ring-2 ring-red-500 ring-offset-1" : ""}`}>
              <CardHeader className="px-3 py-2.5 border-b border-border">
                <EditableColumnHeader
                  column={col}
                  canEdit={canManageColumns}
                  onRename={(id, name) => updateColumnMutation.mutate({ id, name })}
                  onDelete={handleDeleteColumn}
                />
                <p className="text-xs text-muted-foreground">
                  {colTasks.length} task{colTasks.length !== 1 ? "s" : ""}
                </p>
              </CardHeader>

              <CardContent className="flex flex-col gap-2 p-2 flex-1 min-h-[60px]">
                {isLoading ? (
                  [...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
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
                          draggedTask?.id === task.id ? "opacity-40" : "opacity-100",
                          dragOverTaskId === task.id && draggedTask?.id !== task.id ? "ring-1 ring-red-400 rounded-lg" : "",
                          canEdit ? "cursor-move" : "",
                        ].join(" ")}
                      >
                        <TaskCard
                          task={task}
                          onClick={() => onTaskClick?.(task)}
                          onChecklistToggle={onChecklistToggle}
                          onTitleEdit={canEdit ? onTitleEdit : undefined}
                          compact
                        />
                      </div>
                    ))}

                    {colTasks.length === 0 && !isDropTarget && (
                      <div className="text-center text-muted-foreground py-6 text-xs border-2 border-dashed border-border rounded-lg">
                        No tasks
                      </div>
                    )}

                    {isDropTarget && (
                      <div className="border-2 border-dashed border-red-400 rounded-lg py-4 text-center text-sm text-red-500 font-medium">
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

      {/* Add Column button */}
      {canManageColumns && (
        <div className="shrink-0 w-64">
          {addingColumn ? (
            <Card className="p-3 space-y-2">
              <input
                className="w-full text-sm border-b border-foreground bg-transparent outline-none pb-1 placeholder:text-muted-foreground"
                placeholder="Column name…"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddColumn();
                  if (e.key === "Escape") { setAddingColumn(false); setNewColName(""); }
                }}
                autoFocus
              />
              <div className="flex gap-2 items-center">
                <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={handleAddColumn}>
                  Add column
                </Button>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => { setAddingColumn(false); setNewColName(""); }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ) : (
            <button
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 border-2 border-dashed border-border transition-colors"
              onClick={() => setAddingColumn(true)}
            >
              <Plus className="h-4 w-4" />
              Add column
            </button>
          )}
        </div>
      )}
    </div>
  );
}
