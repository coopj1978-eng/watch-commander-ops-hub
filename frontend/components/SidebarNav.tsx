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
  ShieldCheck,
  GraduationCap,
  Megaphone,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";
import { useAuth } from "@/App";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  ariaLabel: string;
  /** Feature flag key — if set, item is hidden when the flag is off (unless WC/admin) */
  featureKey?: keyof FeatureFlags;
  /** If true, only shown to admin/WC users */
  adminOnly?: boolean;
  /** Optional small right-aligned count badge (shown only in expanded mode).
   *  Wiring to real data is a follow-up; all items currently render without a count. */
  count?: number;
}

// Nav items are grouped into three labelled sections (Operations / Work /
// Admin) matching the "command-room" design refresh mockup. Group headings
// render in expanded mode only; the collapsed rail hides them to keep the
// narrow column visually clean.
interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  // ── Operations — day-to-day command ────────────────────────────────────────
  {
    label: "Operations",
    items: [
      { name: "Dashboard", path: "/",         icon: LayoutDashboard, ariaLabel: "Go to Dashboard",             featureKey: "dashboard" },
      { name: "People",    path: "/people",   icon: Users,           ariaLabel: "Go to People",                featureKey: "people" },
      { name: "Calendar",  path: "/calendar", icon: Calendar,        ariaLabel: "Go to Calendar",              featureKey: "calendar" },
      { name: "Tasks",     path: "/tasks",    icon: CheckSquare,     ariaLabel: "Go to Tasks",                 featureKey: "tasks" },
      { name: "Shift",     path: "/handover", icon: ClipboardList,   ariaLabel: "Go to Shift Management",      featureKey: "handover" },
      { name: "Bulletins", path: "/bulletins", icon: Megaphone,      ariaLabel: "Go to Bulletins" },
    ],
  },
  // ── Work — operational admin ───────────────────────────────────────────────
  {
    label: "Work",
    items: [
      { name: "Targets",     path: "/targets",     icon: Target,        ariaLabel: "Go to Targets",             featureKey: "targets" },
      { name: "Detachments", path: "/detachments", icon: Navigation,    ariaLabel: "Go to Detachment Rota",     featureKey: "detachments" },
      { name: "J4 Checks",   path: "/equipment",   icon: Truck,         ariaLabel: "Go to J4 Equipment Checks", featureKey: "equipment" },
      { name: "Training",    path: "/training",    icon: GraduationCap, ariaLabel: "Go to Training" },
      { name: "Docs",        path: "/policies",    icon: FileText,      ariaLabel: "Go to Policy & Guidance",   featureKey: "policies" },
      { name: "Resources",   path: "/resources",   icon: BookOpen,      ariaLabel: "Go to Resources & Guides",  featureKey: "resources" },
    ],
  },
  // ── Admin — personal & system ──────────────────────────────────────────────
  {
    label: "Admin",
    items: [
      { name: "My Profile", path: "/profile",  icon: UserCircle, ariaLabel: "Go to My Profile" },
      { name: "Settings",   path: "/settings", icon: Settings,   ariaLabel: "Go to Settings" },
      { name: "Admin",      path: "/admin",    icon: ShieldCheck, ariaLabel: "Go to Admin Panel", adminOnly: true },
    ],
  },
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
  const { flags } = useFeatureFlags();
  const { user } = useAuth();

  const isWCOrAdmin = user?.role === "WC" || user?.is_admin === true;

  // Filter groups/items by feature flags + admin access, drop empty groups.
  const filteredGroups: NavGroup[] = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.adminOnly && !isWCOrAdmin) return false;
        if (item.featureKey && !isWCOrAdmin && !flags[item.featureKey]) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        // Near-black "command-room" panel. bg-neutral-900 keeps it readable
        // against any content background; dark variant nudges it slightly
        // deeper so dark-mode users don't see two identical darks touching.
        "fixed left-0 top-0 h-screen bg-neutral-900 dark:bg-neutral-950",
        "flex flex-col py-4 shadow-lg z-40 border-r border-white/5",
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
        "mb-3 flex items-center shrink-0",
        expanded ? "w-full px-4 pb-3 border-b border-white/10 gap-3" : "justify-center pb-2",
      )}>
        {/* "WC" mark — tight square, user-pickable brand accent. Uses the
            brighter variant because the sidebar bg is always dark. */}
        <div className={cn(
          "bg-brand-bright text-neutral-900 flex items-center justify-center shrink-0",
          "font-mono font-semibold tracking-wide",
          "transition-all duration-300",
          expanded ? "w-8 h-8 text-xs rounded-sm" : "w-10 h-10 text-sm rounded",
        )}>
          WC
        </div>
        {expanded && (
          <div
            className="min-w-0 animate-in fade-in-0 slide-in-from-left-1 duration-200"
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-white font-semibold text-[13px] leading-tight">Watch Commander</p>
            <p className="text-white/40 font-mono text-[10px] uppercase tracking-[0.08em] leading-tight mt-0.5">
              Ops Hub · Station A
            </p>
          </div>
        )}
      </div>

      {/* ── Nav items ───────────────────────────────────────────────────── */}
      <TooltipProvider delayDuration={300}>
        <nav className={cn(
          "flex-1 flex flex-col w-full overflow-y-auto scrollbar-none",
          expanded ? "gap-0.5 px-2" : "gap-1 px-3",
        )}>
          {filteredGroups.map((group, gi) => (
            <Fragment key={group.label}>
              {/* Group heading (expanded only). On the collapsed rail we
                  drop a thin divider instead to preserve the grouping
                  rhythm without text. The first group needs no separator. */}
              {expanded ? (
                <div
                  className="px-3 pt-4 pb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/40"
                  aria-hidden="true"
                >
                  {group.label}
                </div>
              ) : (
                gi > 0 && (
                  <div className="my-1 mx-3 h-px bg-white/10 rounded-full" aria-hidden="true" />
                )
              )}

              {group.items.map((item) => {
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
                      "relative flex items-center rounded-sm",
                      "transition-colors duration-150",
                      "hover:bg-white/5",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-bright",
                      expanded
                        ? "w-full h-9 gap-3 px-3"
                        : "justify-center w-14 h-11",
                      isActive && cn(
                        "bg-white/10",
                        // Left accent bar — user-pickable brand colour
                        "before:absolute before:left-0 before:top-1.5 before:bottom-1.5",
                        "before:w-[2px] before:rounded-r before:bg-brand-bright",
                      ),
                    )}
                  >
                    <Icon
                      className={cn(
                        "shrink-0 transition-colors",
                        expanded ? "h-[18px] w-[18px]" : "h-5 w-5",
                        isActive ? "text-brand-bright" : "text-white/50 group-hover:text-white/80",
                      )}
                      aria-hidden="true"
                    />
                    {expanded && (
                      <>
                        <span
                          className={cn(
                            "flex-1 text-[13px] truncate",
                            "animate-in fade-in-0 duration-150",
                            isActive ? "text-white" : "text-white/70",
                          )}
                          style={{ animationDelay: "120ms" }}
                        >
                          {item.name}
                        </span>
                        {/* Count badge — only rendered when a count is
                            supplied. Opt-in, so items without counts are
                            visually unaffected until someone wires one in. */}
                        {typeof item.count === "number" && item.count > 0 && (
                          <span
                            className="ml-auto font-mono text-[10.5px] text-white/40 tabular-nums"
                            aria-label={`${item.count} items`}
                          >
                            {item.count}
                          </span>
                        )}
                      </>
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
        "mt-2 shrink-0 border-t border-white/5 pt-2",
        expanded ? "w-full px-2" : "flex justify-center",
      )}>
        <button
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className={cn(
            "flex items-center rounded-sm",
            "text-white/40 hover:text-white/80 hover:bg-white/5",
            "transition-colors duration-150",
            expanded ? "w-full h-9 gap-3 px-3" : "w-14 h-10 justify-center",
          )}
        >
          {expanded ? (
            <>
              <ChevronsLeft className="h-4 w-4 shrink-0" />
              <span
                className="text-[11px] font-mono uppercase tracking-[0.14em] animate-in fade-in-0 duration-150"
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
