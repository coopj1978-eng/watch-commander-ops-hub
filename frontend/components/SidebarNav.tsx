import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  ClipboardList,
  Target,
  FileText,
  BookOpen,
  Settings,
  Truck,
  Navigation,
  ChevronsLeft,
  ChevronsRight,
  UserCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  ariaLabel: string;
}

// Items are grouped — a divider renders between each group
const navGroups: NavItem[][] = [
  // ── Command ─────────────────────────────────────────────────────────────
  [
    { name: "Dashboard", path: "/", icon: LayoutDashboard, ariaLabel: "Go to Dashboard" },
  ],
  // ── People & Planning ────────────────────────────────────────────────────
  [
    { name: "People",       path: "/people",       icon: Users,       ariaLabel: "Go to People" },
    { name: "Calendar",     path: "/calendar",     icon: Calendar,    ariaLabel: "Go to Calendar" },
    { name: "Tasks",        path: "/tasks",        icon: CheckSquare, ariaLabel: "Go to Tasks" },
    { name: "Targets",      path: "/targets",      icon: Target,      ariaLabel: "Go to Targets" },
    { name: "Detachments",  path: "/detachments",  icon: Navigation,  ariaLabel: "Go to Detachment Rota" },
  ],
  // ── Operations ───────────────────────────────────────────────────────────
  [
    { name: "J4 Checks",   path: "/equipment",   icon: Truck,          ariaLabel: "Go to J4 Equipment Checks" },
    { name: "Shift",       path: "/handover",    icon: ClipboardList,  ariaLabel: "Go to Shift Management" },
  ],
  // ── Reference & Account ──────────────────────────────────────────────────
  [
    { name: "My Profile", path: "/profile",  icon: UserCircle, ariaLabel: "Go to My Profile" },
    { name: "Policies",   path: "/policies",  icon: FileText, ariaLabel: "Go to Policies & Q&A" },
    { name: "Resources",  path: "/resources", icon: BookOpen,  ariaLabel: "Go to Resources & Guides" },
    { name: "Settings",   path: "/settings",  icon: Settings,  ariaLabel: "Go to Settings" },
  ],
];

interface SidebarNavProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** Whether the nav rail is expanded to show text labels */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function SidebarNav({
  isOpen = false,
  onClose,
  expanded = false,
  onToggleExpand,
}: SidebarNavProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-gradient-to-b from-indigo-600 to-purple-700",
        "flex flex-col py-4 shadow-lg z-40",
        "transition-all duration-300 ease-in-out",
        "print:hidden",
        expanded ? "w-56 items-start" : "w-20 items-center",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Brand / Logo ────────────────────────────────────────────────── */}
      <div className={cn(
        "mb-5 flex items-center shrink-0",
        expanded ? "w-full px-4 gap-3" : "justify-center",
      )}>
        <div className={cn(
          "bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0",
          "transition-all duration-300",
          expanded ? "w-9 h-9 rounded-xl" : "w-12 h-12 rounded-2xl",
        )}>
          <span className={cn(
            "text-white font-bold transition-all duration-300",
            expanded ? "text-sm" : "text-xl",
          )}>
            WC
          </span>
        </div>
        {expanded && (
          <div
            className="min-w-0 animate-in fade-in-0 slide-in-from-left-1 duration-200"
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-white font-semibold text-sm leading-tight">Watch Cmd</p>
            <p className="text-white/60 text-xs leading-tight">Ops Hub</p>
          </div>
        )}
      </div>

      {/* ── Nav items ───────────────────────────────────────────────────── */}
      <TooltipProvider delayDuration={300}>
        <nav className={cn(
          "flex-1 flex flex-col w-full overflow-y-auto scrollbar-none",
          expanded ? "gap-0.5 px-2" : "gap-1 px-3",
        )}>
          {navGroups.map((group, gi) => (
            <Fragment key={gi}>
              {gi > 0 && (
                <div className={cn(
                  "my-1 h-px bg-white/20 rounded-full",
                  expanded ? "mx-2" : "mx-1",
                )} />
              )}

              {group.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== "/" && location.pathname.startsWith(item.path));

                const linkEl = (
                  <Link
                    to={item.path}
                    onClick={onClose}
                    aria-label={item.ariaLabel}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex items-center rounded-xl",
                      "transition-all duration-200 ease-in-out",
                      "hover:bg-white/20",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                      "focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      expanded
                        ? "w-full h-10 gap-3 px-3"
                        : "justify-center w-14 h-11 hover:scale-105",
                      isActive
                        ? cn(
                          "bg-white/20 shadow-lg",
                          "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                          "before:w-1 before:rounded-r-full before:bg-white",
                          expanded ? "before:h-5" : "before:h-8",
                        )
                        : "hover:shadow-md",
                    )}
                  >
                    <Icon
                      className={cn(
                        "shrink-0 transition-colors",
                        expanded ? "h-5 w-5" : "h-6 w-6",
                        isActive ? "text-white" : "text-white/70",
                      )}
                      aria-hidden="true"
                    />
                    {expanded && (
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          "animate-in fade-in-0 duration-150",
                          isActive ? "text-white" : "text-white/80",
                        )}
                        style={{ animationDelay: "120ms" }}
                      >
                        {item.name}
                      </span>
                    )}
                  </Link>
                );

                // No tooltip needed when labels are visible
                if (expanded) {
                  return <Fragment key={item.path}>{linkEl}</Fragment>;
                }

                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </Fragment>
          ))}
        </nav>
      </TooltipProvider>

      {/* ── Expand / collapse toggle ────────────────────────────────────── */}
      <div className={cn(
        "mt-2 shrink-0",
        expanded ? "w-full px-2" : "flex justify-center",
      )}>
        <button
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className={cn(
            "flex items-center rounded-xl",
            "text-white/50 hover:text-white/90 hover:bg-white/10",
            "transition-all duration-200",
            expanded ? "w-full h-10 gap-3 px-3" : "w-14 h-10 justify-center",
          )}
        >
          {expanded ? (
            <>
              <ChevronsLeft className="h-4 w-4 shrink-0" />
              <span
                className="text-xs font-medium animate-in fade-in-0 duration-150"
                style={{ animationDelay: "120ms" }}
              >
                Collapse
              </span>
            </>
          ) : (
            <ChevronsRight className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
