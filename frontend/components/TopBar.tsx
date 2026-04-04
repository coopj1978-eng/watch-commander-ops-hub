import { useAuth } from "@/App";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import backend from "@/lib/backend";
import { Bell, Calendar, Menu, Stethoscope, AlertCircle, Info, CheckCheck, ShieldAlert, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import ThemeSwitcher from "./ThemeSwitcher";
import type { notification } from "@/client";

interface TopBarProps {
  onMenuClick?: () => void;
}

function NotificationIcon({ type }: { type: notification.NotificationType }) {
  switch (type) {
    case "sick_booking":
      return <Stethoscope className="h-4 w-4 text-red-500 shrink-0" />;
    case "cert_expiry":
      return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "task_overdue":
      return <ClipboardList className="h-4 w-4 text-orange-500 shrink-0" />;
    case "crewing_gap":
      return <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />;
    default:
      return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
  }
}

function groupNotifications(notifications: notification.Notification[]) {
  const now = new Date();
  const today: notification.Notification[] = [];
  const thisWeek: notification.Notification[] = [];
  const older: notification.Notification[] = [];
  for (const n of notifications) {
    const d = new Date(n.created_at);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays < 1) today.push(n);
    else if (diffDays < 7) thisWeek.push(n);
    else older.push(n);
  }
  return { today, thisWeek, older };
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => backend.notification.list(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Refresh (generate new) notifications on load
  useQuery({
    queryKey: ["notifications-refresh"],
    queryFn: async () => {
      const result = await backend.notification.refresh();
      if (result.generated > 0) {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      return result;
    },
    refetchInterval: 5 * 60_000, // re-check every 5 minutes
    refetchOnWindowFocus: true,
    staleTime: 4 * 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => backend.notification.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => backend.notification.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleNotificationClick = (n: notification.Notification) => {
    if (!n.read) markReadMutation.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unread_count ?? 0;
  const { today, thisWeek, older } = groupNotifications(notifications);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 py-3 md:py-4 bg-background/80 backdrop-blur-md border-b border-border print:hidden">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — only shown on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 rounded-lg hover:bg-muted shrink-0"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <h1 className="text-lg md:text-2xl font-bold text-foreground whitespace-nowrap">
          <span className="hidden sm:inline">{getGreeting()}, {firstName}!</span>
          <span className="sm:hidden">Hi, {firstName}!</span>
        </h1>

        <div className="hidden md:flex items-center gap-2 ml-3 px-3 py-1 rounded-lg bg-muted/60">
          <span className="text-xs font-medium text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs font-semibold text-foreground">
            {new Date().getHours() >= 8 && new Date().getHours() < 18
              ? "Day Shift"
              : "Night Shift"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <ThemeSwitcher />

        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex relative h-10 w-10 rounded-xl hover:bg-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Calendar"
        >
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </Button>

        {/* Notification Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-xl hover:bg-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Notifications, ${unreadCount} unread`}
            >
              <Bell className={`h-5 w-5 ${unreadCount > 0 ? "text-foreground" : "text-muted-foreground"}`} />
              {unreadCount > 0 && (
                <Badge
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-red-500 text-white text-xs"
                  aria-label={`${unreadCount} unread notifications`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-96 p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div>
                <h3 className="font-semibold text-foreground">Notifications</h3>
                <p className="text-xs text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread` : "All caught up ✓"}
                </p>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Bell className="h-6 w-6 opacity-40" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">You're all caught up</p>
                    <p className="text-xs mt-0.5">No notifications right now</p>
                  </div>
                </div>
              ) : (
                <>
                  {[
                    { label: "Today", items: today },
                    { label: "This week", items: thisWeek },
                    { label: "Older", items: older },
                  ].map(({ label, items }) =>
                    items.length === 0 ? null : (
                      <div key={label}>
                        <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/20 border-b border-border/40">
                          {label}
                        </div>
                        {items.map((n) => (
                          <button
                            key={n.id}
                            className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0 ${!n.read ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""} ${n.link ? "cursor-pointer" : "cursor-default"}`}
                            onClick={() => handleNotificationClick(n)}
                          >
                            <div className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                              <NotificationIcon type={n.type} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-xs font-semibold leading-snug ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                                  {n.title}
                                </p>
                                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                                {n.message}
                              </p>
                              {n.link && (
                                <span className="text-[10px] text-indigo-500 mt-1 inline-block">
                                  Tap to view →
                                </span>
                              )}
                            </div>
                            {!n.read && (
                              <div className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-2" />
                            )}
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{notifications.length} total</span>
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 px-2 md:px-3 rounded-xl hover:bg-muted transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-semibold shrink-0">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">{user?.name || "User"}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <button
                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
                onClick={signOut}
              >
                Sign Out
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
