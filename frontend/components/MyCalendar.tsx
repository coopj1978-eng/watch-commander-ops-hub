import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import backend from "~backend/client";
import type { Task } from "~backend/task/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyCalendar() {
  const { user } = useUser();

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["my-calendar-tasks", user?.id],
    queryFn: async () => {
      if (!user) return { tasks: [], total: 0 };
      return await backend.task.list({ 
        assigned_to: user.id,
        limit: 100,
      });
    },
    enabled: !!user,
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["my-calendar-events", user?.id],
    queryFn: async () => {
      if (!user) return { events: [], total: 0 };
      return await backend.calendar.list({ limit: 100 });
    },
    enabled: !!user,
  });

  const tasks = tasksData?.tasks || [];
  const events = eventsData?.events || [];

  const calendarItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      date: Date;
      type: "task" | "event";
      category?: string;
      location?: string;
      priority?: string;
      completed?: boolean;
    }> = [];

    tasks.forEach((task: Task) => {
      if (task.due_at) {
        items.push({
          id: `task-${task.id}`,
          title: task.title,
          date: new Date(task.due_at),
          type: "task",
          category: task.category,
          priority: task.priority,
          completed: task.status === "Done",
        });
      }
    });

    events.forEach(event => {
      items.push({
        id: `event-${event.id}`,
        title: event.title,
        date: new Date(event.start_time),
        type: "event",
        location: event.location,
      });
    });

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [tasks, events]);

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getItemsForDate = (day: number) => {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return calendarItems.filter(item => {
      const itemDate = item.date.toISOString().split("T")[0];
      return itemDate === dateKey;
    });
  };

  const upcomingItems = calendarItems.filter(item => {
    const itemDate = new Date(item.date);
    itemDate.setHours(0, 0, 0, 0);
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    return itemDate >= checkDate;
  }).slice(0, 10);

  if (tasksLoading || eventsLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">My Calendar</h2>
        <p className="text-muted-foreground mt-1">
          Your assigned tasks and events
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                {monthNames[currentMonth]} {currentYear}
              </CardTitle>
              <CardDescription>Tasks and events assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center font-semibold text-sm text-muted-foreground p-2">
                    {day}
                  </div>
                ))}
                {emptyDays.map((i) => (
                  <div key={`empty-${i}`} className="min-h-20 p-2 border rounded-md bg-muted/20" />
                ))}
                {calendarDays.map((day) => {
                  const dayItems = getItemsForDate(day);
                  const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                  
                  return (
                    <div
                      key={day}
                      className={`min-h-20 p-2 border rounded-md ${
                        isToday ? "border-red-600 bg-red-50 dark:bg-red-950/20" : "bg-card"
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${isToday ? "text-red-600" : ""}`}>
                        {day}
                      </div>
                      <div className="space-y-1">
                        {dayItems.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            className={`text-xs p-1 rounded cursor-pointer ${
                              item.type === "task" 
                                ? item.completed
                                  ? "bg-green-100 dark:bg-green-950/20 text-green-700 dark:text-green-400 line-through"
                                  : item.priority === "high" || item.priority === "critical"
                                  ? "bg-red-100 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                                  : "bg-blue-100 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400"
                                : "bg-purple-100 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400"
                            }`}
                          >
                            <div className="truncate font-medium">{item.title}</div>
                          </div>
                        ))}
                        {dayItems.length > 2 && (
                          <div className="text-xs text-muted-foreground text-center">
                            +{dayItems.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Upcoming
              </CardTitle>
              <CardDescription>Next 10 items</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingItems.length > 0 ? (
                <div className="space-y-3">
                  {upcomingItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-border hover:border-red-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-foreground flex-1">
                          {item.title}
                        </p>
                        {item.type === "task" && item.completed && (
                          <Badge className="bg-green-500/10 text-green-500 text-xs">Done</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {item.date.toLocaleDateString()}
                      </div>
                      {item.location && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          {item.location}
                        </div>
                      )}
                      {item.type === "task" && (
                        <Badge 
                          variant="outline" 
                          className="mt-2 text-xs"
                        >
                          Task
                        </Badge>
                      )}
                      {item.type === "event" && (
                        <Badge 
                          variant="outline" 
                          className="mt-2 text-xs bg-purple-500/10 text-purple-500 border-purple-500/20"
                        >
                          Event
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No upcoming items
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
