import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, Calendar, AlertCircle, CheckCircle2, Clock, Repeat } from "lucide-react";
import type { Task, TaskStatus, TaskPriority, TaskCategory } from "~backend/task/types";

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
}

type DueFilter = "all" | "overdue" | "today" | "week" | "month";

export default function TaskList({ tasks, isLoading, onTaskClick }: TaskListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "all">("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");

  const filteredTasks = tasks.filter((task) => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    if (statusFilter !== "all" && task.status !== statusFilter) {
      return false;
    }

    if (priorityFilter !== "all" && task.priority !== priorityFilter) {
      return false;
    }

    if (categoryFilter !== "all" && task.category !== categoryFilter) {
      return false;
    }

    if (dueFilter !== "all" && task.due_at) {
      const dueDate = new Date(task.due_at);
      const now = new Date();
      const diffMs = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (dueFilter === "overdue" && diffDays >= 0) return false;
      if (dueFilter === "today" && diffDays !== 0) return false;
      if (dueFilter === "week" && (diffDays < 0 || diffDays > 7)) return false;
      if (dueFilter === "month" && (diffDays < 0 || diffDays > 30)) return false;
    }

    return true;
  });

  const getDueBadge = (task: Task) => {
    if (!task.due_at) return null;

    const dueDate = new Date(task.due_at);
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (task.status === "Done") {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    }

    if (diffDays < 0) {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue {Math.abs(diffDays)}d
        </Badge>
      );
    }

    if (diffDays === 0) {
      return (
        <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Due Today
        </Badge>
      );
    }

    if (diffDays <= 3) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Due in {diffDays}d
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs">
        <Calendar className="h-3 w-3 mr-1" />
        {dueDate.toLocaleDateString()}
      </Badge>
    );
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      High: "bg-red-500/10 text-red-500 border-red-500/20",
      Med: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    };
    return colors[priority] || colors.Med;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NotStarted: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
      InProgress: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      Blocked: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      Done: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    };
    return colors[status] || colors.NotStarted;
  };

  const statusLabels: Record<TaskStatus, string> = {
    NotStarted: "Not Started",
    InProgress: "In Progress",
    Blocked: "Blocked",
    Done: "Done",
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all" || dueFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setDueFilter("all");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label htmlFor="search" className="sr-only">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="status-filter" className="sr-only">Status</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "all")}>
            <SelectTrigger id="status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="NotStarted">Not Started</SelectItem>
              <SelectItem value="InProgress">In Progress</SelectItem>
              <SelectItem value="Blocked">Blocked</SelectItem>
              <SelectItem value="Done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="priority-filter" className="sr-only">Priority</Label>
          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as TaskPriority | "all")}>
            <SelectTrigger id="priority-filter">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Med">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="category-filter" className="sr-only">Category</Label>
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as TaskCategory | "all")}>
            <SelectTrigger id="category-filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Training">Training</SelectItem>
              <SelectItem value="Inspection">Inspection</SelectItem>
              <SelectItem value="HFSV">HFSV</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="due-filter" className="sr-only">Due Date</Label>
          <Select value={dueFilter} onValueChange={(value) => setDueFilter(value as DueFilter)}>
            <SelectTrigger id="due-filter">
              <SelectValue placeholder="Due" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Due Dates</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Due Today</SelectItem>
              <SelectItem value="week">Due This Week</SelectItem>
              <SelectItem value="month">Due This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </p>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </div>
      )}

      <div className="border rounded-lg">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(6)].map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map((task) => {
                const checklistProgress = task.checklist
                  ? {
                      completed: task.checklist.filter((item) => item.done).length,
                      total: task.checklist.length,
                      percentage: Math.round(
                        (task.checklist.filter((item) => item.done).length / task.checklist.length) * 100
                      ),
                    }
                  : null;

                return (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onTaskClick?.(task)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {task.rrule && (
                          <div title="Recurring task">
                            <Repeat className="h-4 w-4 text-blue-500" />
                          </div>
                        )}
                        <span>{task.title}</span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          {task.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(task.status)} variant="outline">
                        {statusLabels[task.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(task.priority)} variant="outline">
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {task.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{getDueBadge(task)}</TableCell>
                    <TableCell>
                      {checklistProgress ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
                            <div
                              className="h-full bg-red-500 transition-all"
                              style={{ width: `${checklistProgress.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {checklistProgress.completed}/{checklistProgress.total}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters ? "No tasks match your filters" : "No tasks yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
