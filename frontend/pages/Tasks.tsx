import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Plus, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUserRole } from "@/lib/rbac";
import TaskBoard from "@/components/TaskBoard";
import TaskList from "@/components/TaskList";
import TaskTemplatePicker from "@/components/TaskTemplatePicker";
import type { Task, ChecklistItem, TaskStatus } from "~backend/task/types";

export default function Tasks() {
  const { user } = useAuth();
  const userRole = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const canAssignTasks = ["WC", "CC"].includes(userRole);
  const canEditStatus = ["WC", "CC", "FF"].includes(userRole);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const result = await backend.task.list({ limit: 1000 });
      return result.tasks;
    },
  });

  const filteredTasks = canAssignTasks
    ? tasks
    : tasks.filter((task) => task.assigned_to_user_id === user?.id);

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      return backend.task.create({
        ...data,
        assigned_by: user?.id || "user_123",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: (error) => {
      console.error("Create task error:", error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (params: { id: number } & any) => {
      return backend.task.update(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: (error) => {
      console.error("Update task error:", error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const handleTemplateSelect = (template: any) => {
    if (!canAssignTasks) {
      toast({
        title: "Permission Denied",
        description: "Only Watch Commanders and Crew Commanders can create tasks from templates",
        variant: "destructive",
      });
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.estimatedDays);

    const checklist: ChecklistItem[] = template.checklist.map((item: any) => ({
      ...item,
      done: false,
    }));

    createTaskMutation.mutate({
      title: template.name,
      description: template.description,
      category: template.category,
      priority: template.priority,
      due_date: dueDate,
      checklist,
      rrule: template.rrule,
    });
  };

  const handleChecklistToggle = async (taskId: number, itemLabel: string, done: boolean) => {
    const task = filteredTasks.find((t) => t.id === taskId);
    if (!task || !task.checklist) return;

    if (userRole === "FF" && task.assigned_to_user_id !== user?.id) {
      toast({
        title: "Permission Denied",
        description: "You can only update checklists for your own tasks",
        variant: "destructive",
      });
      return;
    }

    const updatedChecklist = task.checklist.map((item) =>
      item.label === itemLabel ? { ...item, done } : item
    );

    updateTaskMutation.mutate({
      id: taskId,
      checklist: updatedChecklist,
    });
  };

  const handleStatusChange = (taskId: number, newStatus: TaskStatus) => {
    const task = filteredTasks.find((t) => t.id === taskId);
    if (!task) return;

    if (userRole === "FF" && task.assigned_to_user_id !== user?.id) {
      toast({
        title: "Permission Denied",
        description: "You can only update status for your own tasks",
        variant: "destructive",
      });
      return;
    }

    if (!canEditStatus) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to change task status",
        variant: "destructive",
      });
      return;
    }

    updateTaskMutation.mutate({
      id: taskId,
      status: newStatus,
    });
  };

  const handleTaskClick = (task: Task) => {
    toast({
      title: "Task Details",
      description: `Viewing: ${task.title}`,
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            {canAssignTasks 
              ? "Manage and track all tasks" 
              : "Track your assigned tasks"}
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
          {canAssignTasks && (
            <>
              <Button
                variant="outline"
                className="ml-2"
                onClick={() => setShowTemplatePicker(true)}
              >
                <Zap className="h-4 w-4 mr-2" />
                Templates
              </Button>
              <Button className="bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </>
          )}
        </div>
      </div>

      {viewMode === "board" ? (
        <TaskBoard
          tasks={filteredTasks}
          isLoading={isLoading}
          onTaskClick={handleTaskClick}
          onChecklistToggle={handleChecklistToggle}
          onStatusChange={handleStatusChange}
          canEdit={canEditStatus}
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          isLoading={isLoading}
          onTaskClick={handleTaskClick}
        />
      )}

      {canAssignTasks && (
        <TaskTemplatePicker
          isOpen={showTemplatePicker}
          onClose={() => setShowTemplatePicker(false)}
          onSelectTemplate={handleTemplateSelect}
        />
      )}
    </div>
  );
}
