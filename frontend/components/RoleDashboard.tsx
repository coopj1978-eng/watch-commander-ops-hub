import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/lib/rbac";
import { useAuth } from "@/App";
import { useNavigate } from "react-router-dom";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ClipboardCheck, Target, FileText, ArrowRight, Loader2 } from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  isLoading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <div className="text-3xl font-bold text-foreground">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RoleDashboard() {
  const role = useUserRole();

  if (role === "WC") {
    return <WatchCommanderDashboard />;
  }

  if (role === "CC") {
    return <CrewCommanderDashboard />;
  }

  if (role === "FF") {
    return <FirefighterDashboard />;
  }

  return <ReadOnlyDashboard />;
}

function WatchCommanderDashboard() {
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["dashboard", "users"],
    queryFn: () => backend.user.list({ limit: 1 }),
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["dashboard", "tasks"],
    queryFn: () => backend.task.list({ limit: 1 }),
  });

  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ["dashboard", "targets"],
    queryFn: () => backend.targets.list({ limit: 1000 }),
  });

  const { data: policiesData, isLoading: policiesLoading } = useQuery({
    queryKey: ["dashboard", "policies"],
    queryFn: () => backend.policy.list({ limit: 1 }),
  });

  const targetsProgress = (() => {
    if (!targetsData?.targets?.length) return "0%";
    const totalTarget = targetsData.targets.reduce((sum, t) => sum + (t.target_count || 0), 0);
    const totalActual = targetsData.targets.reduce((sum, t) => sum + (t.actual_count || 0), 0);
    if (totalTarget === 0) return "0%";
    return `${Math.round((totalActual / totalTarget) * 100)}%`;
  })();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Watch Commander Dashboard</h1>
        <p className="text-muted-foreground mt-1">Full administrative access</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Staff"
          value={usersData?.total ?? 0}
          icon={Users}
          iconColor="text-indigo-500"
          isLoading={usersLoading}
        />
        <StatCard
          label="Active Tasks"
          value={tasksData?.total ?? 0}
          icon={ClipboardCheck}
          iconColor="text-blue-500"
          isLoading={tasksLoading}
        />
        <StatCard
          label="Targets Progress"
          value={targetsProgress}
          icon={Target}
          iconColor="text-green-500"
          isLoading={targetsLoading}
        />
        <StatCard
          label="Policy Documents"
          value={policiesData?.total ?? 0}
          icon={FileText}
          iconColor="text-purple-500"
          isLoading={policiesLoading}
        />
      </div>
    </div>
  );
}

function CrewCommanderDashboard() {
  const navigate = useNavigate();

  const { data: crewStats, isLoading } = useQuery({
    queryKey: ["dashboard", "crewStats"],
    queryFn: () => backend.crew.getStats(),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Crew Commander Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your assigned crews</p>
        </div>
        <Button onClick={() => navigate("/people")} size="lg">
          View Crew
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          label="Your Crew"
          value={crewStats?.total_firefighters ?? 0}
          icon={Users}
          iconColor="text-indigo-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Assigned Tasks"
          value={crewStats?.total_tasks ?? 0}
          icon={ClipboardCheck}
          iconColor="text-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label="Inspections Due"
          value={crewStats?.upcoming_inspections ?? 0}
          icon={Target}
          iconColor="text-yellow-500"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

function FirefighterDashboard() {
  const { user } = useAuth();

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["dashboard", "myTasks"],
    queryFn: () => backend.task.list({ limit: 1 }),
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ["dashboard", "myCalendar"],
    queryFn: () =>
      backend.calendar.list({
        user_id: user?.id,
        start_date: new Date().toISOString(),
        limit: 1,
      }),
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your tasks and schedule</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <StatCard
          label="My Tasks"
          value={tasksData?.total ?? 0}
          icon={ClipboardCheck}
          iconColor="text-blue-500"
          isLoading={tasksLoading}
        />
        <StatCard
          label="Upcoming Events"
          value={calendarData?.total ?? 0}
          icon={Target}
          iconColor="text-green-500"
          isLoading={calendarLoading}
        />
      </div>
    </div>
  );
}

function ReadOnlyDashboard() {
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["dashboard", "users"],
    queryFn: () => backend.user.list({ limit: 1 }),
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["dashboard", "tasks"],
    queryFn: () => backend.task.list({ limit: 1 }),
  });

  const { data: policiesData, isLoading: policiesLoading } = useQuery({
    queryKey: ["dashboard", "policies"],
    queryFn: () => backend.policy.list({ limit: 1 }),
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Overview Dashboard</h1>
        <p className="text-muted-foreground mt-1">Read-only access</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          label="Total Staff"
          value={usersData?.total ?? 0}
          icon={Users}
          iconColor="text-indigo-500"
          isLoading={usersLoading}
        />
        <StatCard
          label="Active Tasks"
          value={tasksData?.total ?? 0}
          icon={ClipboardCheck}
          iconColor="text-blue-500"
          isLoading={tasksLoading}
        />
        <StatCard
          label="Policy Documents"
          value={policiesData?.total ?? 0}
          icon={FileText}
          iconColor="text-purple-500"
          isLoading={policiesLoading}
        />
      </div>
    </div>
  );
}
