import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar as CalendarIcon,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Five most-used WC destinations on mobile
const navItems = [
  { name: "Dashboard",   path: "/",            icon: LayoutDashboard },
  { name: "People",      path: "/people",       icon: Users },
  { name: "Tasks",       path: "/tasks",        icon: CheckSquare },
  { name: "Calendar",    path: "/calendar",     icon: CalendarIcon },
  { name: "Shift",       path: "/handover",     icon: ClipboardList },
] as const;

export function MobileBottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "md:hidden",                               // desktop: sidebar handles nav
        "bg-background/90 backdrop-blur-md",
        "border-t border-border/60",
        "pb-[env(safe-area-inset-bottom)]",        // iPhone safe area
        "shadow-[0_-4px_24px_rgba(0,0,0,0.06)]",
      )}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? pathname === "/"
              : pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={`Go to ${item.name}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset",
                isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground",
              )}
            >
              {/* Active indicator dot */}
              <span
                className={cn(
                  "w-1 h-1 rounded-full mb-0.5 transition-all duration-150",
                  isActive ? "bg-indigo-500 scale-100" : "scale-0 bg-transparent",
                )}
                aria-hidden="true"
              />
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform duration-150",
                  isActive && "scale-110",
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight",
                  isActive ? "font-semibold" : "",
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
