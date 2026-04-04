import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import type { Task, TaskStatus } from "~backend/task/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { 
  CheckCircle2, 
  Circle,
  Clock,
  AlertCircle,
  Grid3x3,
  List as ListIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "board" | "list";

export default function MyTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("board");

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ["my-tasks", user?.id],
    queryFn: async () => {
      if (!user) return { tasks: [], total: 0 };
      return await backend.task.list({ 
        assigned_to: user.id,
        limit: 100,
      });
    },
    enabled: !!user,
  });

  const tasks = (tasksData?.tasks || []) as unknown as Task[];

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: TaskStatus }) => {
      return await backend.task.update(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks", user?.id] });
      toast({
        title: "Task updated",
        description: "Task status has been updated",
      });
    },
    onError: (error) => {
      console.error("Failed to update task:", error);
      toast({
        title: "Update failed",
        description: "Failed to update task status",
        variant: "destructive",
      });
    },
  });

  const handleToggleComplete = (task: Task) => {
    updateTaskMutation.mutate({
      id: task.id,
      status: task.status === "Done" ? "NotStarted" : "Done",
    });
  };

  const todoTasks = tasks.filter(t => t.status !== "Done");
  const completedTasks = tasks.filter(t => t.status === "Done");
  
  const overdueTasks = todoTasks.filter(t => {
    if (!t.due_at) return false;
    return new Date(t.due_at) < new Date();
  });

  const dueSoonTasks = todoTasks.filter(t => {
    if (!t.due_at) return false;
    const dueDate = new Date(t.due_at);
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    return dueDate > today && dueDate <= threeDaysFromNow;
  });

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-gray-500/10 text-gray-400",
      medium: "bg-blue-500/10 text-blue-500",
      high: "bg-orange-500/10 text-orange-500",
      critical: "bg-red-500/10 text-red-500",
    };
    return (
      <Badge className={colors[priority as keyof typeof colors] || ""}>
        {priority}
      </Badge>
    );
  };

  const TaskCard = ({ task }: { task: Task }) => (
    <Card className={`${task.status === "Done" ? "opacity-60" : ""} hover:border-indigo-600 transition-colors`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.status === "Done"}
            onCheckedChange={() => handleToggleComplete(task)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <CardTitle className={`text-base ${task.status === "Done" ? "line-through" : ""}`}>
              {task.title}
            </CardTitle>
            {task.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {task.description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-2">
          {task.priority && getPriorityBadge(task.priority)}
          {task.due_at && (
            <Badge 
              variant="outline"
              className={
                task.status !== "Done" && new Date(task.due_at) < new Date()
                  ? "border-red-500 text-red-500"
                  : ""
              }
            >
              <Clock className="h-3 w-3 mr-1" />
              {new Date(task.due_at).toLocaleDateString()}
            </Badge>
          )}
          {task.category && (
            <Badge variant="outline">{task.category}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Tasks</h2>
          <p className="text-muted-foreground mt-1">
            {todoTasks.length} active • {completedTasks.length} completed
          </p>
        </div>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "board" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("board")}
            className="rounded-r-none"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="rounded-l-none"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "board" ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold text-foreground">
                Overdue ({overdueTasks.length})
              </h3>
            </div>
            <div className="space-y-3">
              {overdueTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {overdueTasks.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No overdue tasks
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Circle className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-foreground">
                To Do ({todoTasks.length - overdueTasks.length})
              </h3>
            </div>
            <div className="space-y-3">
              {todoTasks
                .filter(t => !overdueTasks.includes(t))
                .map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              {todoTasks.length === overdueTasks.length && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No pending tasks
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-foreground">
                Completed ({completedTasks.length})
              </h3>
            </div>
            <div className="space-y-3">
              {completedTasks.slice(0, 5).map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {completedTasks.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No completed tasks
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {overdueTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-500 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Overdue
              </h3>
              <div className="space-y-3">
                {overdueTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {dueSoonTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-500 mb-3 flex items-center gap-2 mt-6">
                <Clock className="h-4 w-4" />
                Due Soon
              </h3>
              <div className="space-y-3">
                {dueSoonTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {todoTasks.filter(t => !overdueTasks.includes(t) && !dueSoonTasks.includes(t)).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2 mt-6">
                <Circle className="h-4 w-4" />
                To Do
              </h3>
              <div className="space-y-3">
                {todoTasks
                  .filter(t => !overdueTasks.includes(t) && !dueSoonTasks.includes(t))
                  .map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
              </div>
            </div>
          )}

          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-500 mb-3 flex items-center gap-2 mt-6">
                <CheckCircle2 className="h-4 w-4" />
                Completed
              </h3>
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ListIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground mt-4">No tasks assigned to you</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
