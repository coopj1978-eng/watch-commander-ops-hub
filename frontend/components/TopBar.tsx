import { useUser, UserButton } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "~backend/client";
import { Bell, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import ThemeSwitcher from "./ThemeSwitcher";

export default function TopBar() {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: notificationsData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => backend.notification.list(),
    refetchInterval: 60000,
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unread_count || 0;

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return await backend.notification.markRead({ notification_id: notificationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.firstName || user?.username || "there";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {getGreeting()}, {firstName}!
        </h1>
        <div className="hidden md:flex items-center gap-2 ml-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeSwitcher />
        
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-xl hover:bg-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Calendar"
        >
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-xl hover:bg-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Notifications, ${unreadCount} unread`}
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-red-500 text-white text-xs"
                  aria-label={`${unreadCount} unread notifications`}
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-foreground">Notifications</h3>
              <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
            </div>
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex flex-col items-start gap-1 p-4 cursor-pointer ${
                    !notification.is_read ? "bg-muted/50" : ""
                  }`}
                  onClick={() => {
                    if (!notification.is_read) {
                      markReadMutation.mutate(notification.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="font-medium text-sm">{notification.title}</span>
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-red-600" aria-label="Unread" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{notification.message}</p>
                  <span className="text-xs text-muted-foreground">
                    Due: {new Date(notification.due_date).toLocaleDateString()}
                  </span>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No reminders
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <UserButton 
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-10 w-10 rounded-xl ring-2 ring-offset-2 ring-offset-background ring-transparent hover:ring-primary transition-all duration-200",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
