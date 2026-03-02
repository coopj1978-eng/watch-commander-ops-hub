import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Plus, Repeat } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUserRole } from "@/lib/rbac";
import TaskBoard from "@/components/TaskBoard";
import TaskList from "@/components/TaskList";
import TaskDetailDrawer from "@/components/TaskDetailDrawer";
import TaskTemplateManager from "@/components/TaskTemplateManager";
import type { Task, ChecklistItem, TaskTemplate } from "~backend/task/types";

export default function Tasks() {
  const { user } = useAuth();
  const userRole = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const canAssignTasks = ["WC", "CC"].includes(userRole);
  const canEditStatus = ["WC", "CC", "FF"].includes(userRole);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await backend.task.list({ limit: 1000 })).tasks,
  });

  const { data: columnsData } = useQuery({
    queryKey: ["task-columns"],
    queryFn: async () => (await backend.task.listColumns()).columns,
  });
  const columns = columnsData ?? [];

  const filteredTasks = canAssignTasks
    ? tasks
    : tasks.filter((t) => t.assigned_to_user_id === user?.id);

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) =>
      backend.task.create({ ...data, assigned_by: user?.id || "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to create task", variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (params: { id: number } & any) => {
      const { id, ...rest } = params;
      return backend.task.update(id, rest);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast({ title: "Error", description: "Failed to update task", variant: "destructive" }),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleTaskClick = (task: Task) => setSelectedTask(task);

  const handleDrawerClose = () => {
    // Re-sync selected task with latest data
    if (selectedTask) {
      const fresh = tasks.find((t) => t.id === selectedTask.id);
      setSelectedTask(null);
      // Optionally keep drawer open with fresh data — just close for now
    } else {
      setSelectedTask(null);
    }
  };

  const handleTaskCreate = (title: string, statusKey: string) => {
    if (!canAssignTasks) {
      toast({ title: "Permission Denied", description: "Only WC/CC can create tasks", variant: "destructive" });
      return;
    }
    // Calculate next position in that column
    const colTasks = filteredTasks.filter((t) => t.status === statusKey);
    const maxPos = colTasks.reduce((max, t) => Math.max(max, t.position ?? 0), 0);

    createTaskMutation.mutate({
      title,
      category: "Other",
      priority: "Med",
      status: statusKey,
      position: maxPos + 1,
    });
  };

  const handleNewTask = () => {
    if (!canAssignTasks) return;
    const firstCol = columns[0];
    // Create blank task and open drawer
    createTaskMutation.mutateAsync({
      title: "New Task",
      category: "Other",
      priority: "Med",
      status: firstCol?.status_key ?? "NotStarted",
      position: 0,
    }).then((newTask) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTask(newTask as Task);
    }).catch(() => {});
  };

  const handleTitleEdit = (taskId: number, newTitle: string) => {
    updateTaskMutation.mutate({ id: taskId, title: newTitle });
    // Update selected task if open
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => prev ? { ...prev, title: newTitle } : prev);
    }
  };

  const handleChecklistToggle = (taskId: number, itemLabel: string, done: boolean) => {
    const task = filteredTasks.find((t) => t.id === taskId);
    if (!task || !task.checklist) return;
    if (userRole === "FF" && task.assigned_to_user_id !== user?.id) {
      toast({ title: "Permission Denied", description: "You can only update your own tasks", variant: "destructive" });
      return;
    }
    const updatedChecklist = task.checklist.map((item) =>
      item.label === itemLabel ? { ...item, done } : item
    );
    updateTaskMutation.mutate({ id: taskId, checklist: updatedChecklist });
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    const task = filteredTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (userRole === "FF" && task.assigned_to_user_id !== user?.id) {
      toast({ title: "Permission Denied", description: "You can only update your own tasks", variant: "destructive" });
      return;
    }
    if (!canEditStatus) {
      toast({ title: "Permission Denied", description: "You don't have permission to change task status", variant: "destructive" });
      return;
    }
    updateTaskMutation.mutate({ id: taskId, status: newStatus });
  };

  const handleUseTemplate = (template: TaskTemplate) => {
    if (!canAssignTasks) return;
    const firstCol = columns[0];
    const checklist: ChecklistItem[] = (template.checklist ?? []).map((item) => ({
      ...item,
      done: false,
    }));
    createTaskMutation.mutate({
      title: template.title_template,
      description: template.task_description ?? undefined,
      category: template.category,
      priority: template.priority,
      checklist,
      rrule: template.rrule,
      status: firstCol?.status_key ?? "NotStarted",
    });
    toast({ title: "Task created", description: `"${template.title_template}" added to board` });
  };

  // Keep drawer in sync: when tasks list refreshes, sync selected task
  const syncedSelectedTask = selectedTask
    ? (tasks.find((t) => t.id === selectedTask.id) ?? selectedTask)
    : null;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            {canAssignTasks ? "Manage and track all tasks" : "Track your assigned tasks"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "board" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("board")}
            title="Board view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="ml-2"
            onClick={() => setShowTemplateManager(true)}
          >
            <Repeat className="h-4 w-4 mr-2" />
            Templates
          </Button>
          {canAssignTasks && (
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleNewTask}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* Board / List */}
      {viewMode === "board" ? (
        <TaskBoard
          tasks={filteredTasks}
          isLoading={isLoading}
          onTaskClick={handleTaskClick}
          onChecklistToggle={handleChecklistToggle}
          onStatusChange={handleStatusChange}
          onTaskCreate={handleTaskCreate}
          onTitleEdit={handleTitleEdit}
          canEdit={canEditStatus}
          canManageColumns={canAssignTasks}
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          isLoading={isLoading}
          onTaskClick={handleTaskClick}
        />
      )}

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={syncedSelectedTask}
        columns={columns}
        onClose={() => setSelectedTask(null)}
        onDelete={() => setSelectedTask(null)}
        canEdit={canEditStatus}
      />

      {/* Template Manager */}
      <TaskTemplateManager
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        onUseTemplate={handleUseTemplate}
        canManage={canAssignTasks}
      />
    </div>
  );
}
