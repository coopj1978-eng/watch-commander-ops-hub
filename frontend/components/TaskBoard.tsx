import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import TaskCard from "./TaskCard";
import type { Task, TaskStatus } from "~backend/task/types";

interface TaskBoardProps {
  tasks: Task[];
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
  onChecklistToggle?: (taskId: number, itemId: string, completed: boolean) => void;
  onStatusChange?: (taskId: number, newStatus: TaskStatus) => void;
  canEdit?: boolean;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  NotStarted: { label: "Not Started", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-500/5" },
  InProgress: { label: "In Progress", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/5" },
  Blocked: { label: "Blocked", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500/5" },
  Done: { label: "Done", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/5" },
};

export default function TaskBoard({ 
  tasks, 
  isLoading, 
  onTaskClick, 
  onChecklistToggle,
  onStatusChange,
  canEdit = false
}: TaskBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const tasksByStatus: Record<TaskStatus, Task[]> = {
    NotStarted: tasks.filter((t) => t.status === "NotStarted"),
    InProgress: tasks.filter((t) => t.status === "InProgress"),
    Blocked: tasks.filter((t) => t.status === "Blocked"),
    Done: tasks.filter((t) => t.status === "Done"),
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (!canEdit) return;
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    if (!canEdit || !draggedTask) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (!canEdit || !draggedTask || draggedTask.status === status) {
      setDraggedTask(null);
      setDragOverStatus(null);
      return;
    }

    if (onStatusChange) {
      onStatusChange(draggedTask.id, status);
    }

    setDraggedTask(null);
    setDragOverStatus(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverStatus(null);
  };

  return (
    <div className="grid gap-6 md:grid-cols-4">
      {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((status) => {
        const statusTasks = tasksByStatus[status];
        const config = STATUS_CONFIG[status];
        const isBeingDraggedOver = dragOverStatus === status && draggedTask?.status !== status;

        return (
          <Card 
            key={status} 
            className={`flex flex-col transition-all ${isBeingDraggedOver ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            <CardHeader className={config.bgColor}>
              <CardTitle className={`text-base font-semibold ${config.color}`}>
                {config.label}
              </CardTitle>
              <CardDescription>
                {statusTasks.length} task{statusTasks.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 pt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {statusTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable={canEdit}
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      className={`transition-opacity ${draggedTask?.id === task.id ? 'opacity-50' : 'opacity-100'} ${canEdit ? 'cursor-move' : ''}`}
                    >
                      <TaskCard
                        task={task}
                        onClick={() => onTaskClick?.(task)}
                        onChecklistToggle={onChecklistToggle}
                        compact
                      />
                    </div>
                  ))}
                  {statusTasks.length === 0 && (
                    <div className="text-center text-muted-foreground py-12 text-sm border-2 border-dashed border-border rounded-lg">
                      {isBeingDraggedOver ? (
                        <p className="font-medium text-red-600">Drop here</p>
                      ) : (
                        <p>No tasks</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
