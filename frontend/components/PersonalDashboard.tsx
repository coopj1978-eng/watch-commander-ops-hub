import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import backend from "~backend/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar,
  ListTodo,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PersonalDashboard() {
  const { user } = useUser();

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["my-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const result = await backend.task.list({ 
        assigned_to: user.id,
        limit: 100,
      });
      return result.tasks;
    },
    enabled: !!user,
  });

  const { data: absenceStats } = useQuery({
    queryKey: ["my-absence-stats", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return await backend.absence.getStats({ user_id: user.id });
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return await backend.profile.getByUser({ user_id: user.id });
    },
    enabled: !!user,
  });

  const completedTasks = tasks?.filter(t => t.status === "Done") || [];
  const pendingTasks = tasks?.filter(t => t.status !== "Done") || [];
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.due_at) return false;
    return new Date(t.due_at) < new Date();
  });

  const completionRate = tasks && tasks.length > 0 
    ? (completedTasks.length / tasks.length) * 100 
    : 0;

  if (tasksLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Welcome back, {user?.firstName || "Firefighter"}
        </h2>
        <p className="text-muted-foreground mt-1">
          Here's your overview for today
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingTasks.length} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks.length}</div>
            <Progress value={completionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {completionRate.toFixed(0)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {overdueTasks.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absence Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {absenceStats?.six_month_total || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 6 months
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile?.station && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Station</span>
                <Badge variant="outline">{profile.station}</Badge>
              </div>
            )}
            {profile?.shift && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Shift</span>
                <Badge variant="outline">{profile.shift}</Badge>
              </div>
            )}
            {profile?.rank && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rank</span>
                <Badge variant="outline">{profile.rank}</Badge>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active Tasks</span>
              <span className="font-medium">{pendingTasks.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueTasks.length > 0 ? (
              <div className="space-y-3">
                {overdueTasks.slice(0, 3).map((task) => (
                  <div 
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
                  >
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Due: {new Date(task.due_at!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No overdue tasks - great work!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
