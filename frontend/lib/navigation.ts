import {
  BarChart2,
  BookMarked,
  Calendar,
  CalendarPlus,
  CheckSquare,
  ClipboardList,
  FileHeart,
  FileText,
  Flame,
  GraduationCap,
  House,
  KanbanSquare,
  Megaphone,
  Navigation,
  NotebookPen,
  Settings,
  ShieldCheck,
  Target,
  Truck,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/App";
import { useFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";

// ──────────────────────────────────────────────────────────────────────────────
// The app's menu, in one place (Nov 2026). The desktop sidebar, the phone tab
// bar and its "More" sheet, the ⌘K search and the title bar all read from
// here, so a new page is added once.
// ──────────────────────────────────────────────────────────────────────────────

export type NavBadgeKey = "tasks" | "people" | "bulletins";

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Other words ⌘K search matches on. */
  keywords?: string;
  /** Hidden when this feature is switched off (a WC or admin still sees it). */
  featureKey?: keyof FeatureFlags;
  /** WC or admin only. */
  adminOnly?: boolean;
  /** WC/CC only. */
  managersOnly?: boolean;
  /** Its single-key shortcut (see useKeyboardShortcuts). */
  shortcut?: string;
  /** Live count shown next to it (see useNavBadges). */
  badge?: NavBadgeKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    items: [
      { name: "Home",     path: "/",         icon: House,         featureKey: "dashboard", shortcut: "D", keywords: "dashboard needs you" },
      { name: "Shift",    path: "/handover", icon: ClipboardList, featureKey: "handover",  shortcut: "H", keywords: "handover crewing board riding" },
      { name: "Tasks",    path: "/tasks",    icon: CheckSquare,   featureKey: "tasks",     shortcut: "T", badge: "tasks", keywords: "shift board checks to do" },
      { name: "Calendar", path: "/calendar", icon: Calendar,      featureKey: "calendar",  keywords: "events leave rota" },
    ],
  },
  {
    label: "Crew",
    items: [
      { name: "People",      path: "/people",      icon: Users,         featureKey: "people", shortcut: "P", badge: "people", keywords: "crew staff firefighters profiles" },
      { name: "Bulletins",   path: "/bulletins",   icon: Megaphone,     badge: "bulletins", keywords: "news announcements messages" },
      { name: "Training",    path: "/training",    icon: GraduationCap, keywords: "courses skills certificates" },
      { name: "Detachments", path: "/detachments", icon: Navigation,    featureKey: "detachments", keywords: "detached duty rota" },
    ],
  },
  {
    label: "Station",
    items: [
      { name: "Targets",    path: "/targets",    icon: Target,     featureKey: "targets", shortcut: "G", keywords: "hfsv community multi-story performance" },
      { name: "Reports",    path: "/reports",    icon: BarChart2,  featureKey: "reports", keywords: "quarterly report export csv" },
      { name: "Hydrants",   path: "/hydrants",   icon: Flame,      keywords: "hydrant routes faults" },
      { name: "J4 Checks",  path: "/equipment",  icon: Truck,      featureKey: "equipment", keywords: "equipment appliance defects" },
      { name: "References", path: "/references", icon: BookMarked, keywords: "watch references monthly" },
      { name: "Docs",       path: "/policies",   icon: FileText,   featureKey: "policies", keywords: "policies guidance documents resources processes links" },
    ],
  },
];

/** Under your name: the sidebar's account menu, and the phone's "More" sheet. */
export const ACCOUNT_ITEMS: NavItem[] = [
  { name: "My profile", path: "/profile",  icon: UserCircle, keywords: "me account skills toil" },
  { name: "Settings",   path: "/settings", icon: Settings,   keywords: "appearance branding export dictionaries" },
  { name: "Admin",      path: "/admin",    icon: ShieldCheck, adminOnly: true, keywords: "users feature flags" },
];

// ── Quick add — the phone "+" and the ⌘K "Add" group ─────────────────────────

export interface QuickAction {
  label: string;
  hint: string;
  to: string;
  Icon: LucideIcon;
  tint: string;
}

const TASK: QuickAction = { label: "Task for this shift", hint: "A card on the shift board", to: "/tasks?new=1", Icon: KanbanSquare, tint: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };

export const MANAGER_ACTIONS: QuickAction[] = [
  TASK,
  { label: "Handover note", hint: "For the next watch", to: "/handover?tab=handover&new=1", Icon: NotebookPen, tint: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  { label: "Calendar event", hint: "Station, watch or personal", to: "/calendar?new=1", Icon: CalendarPlus, tint: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  { label: "Crewing", hint: "Who's riding what", to: "/handover", Icon: Truck, tint: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
];

export const CREW_ACTIONS: QuickAction[] = [
  TASK,
  { label: "Calendar event", hint: "On your personal calendar", to: "/calendar?new=1", Icon: CalendarPlus, tint: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  { label: "Leave or sick line", hint: "Request leave, attach a sick line", to: "/?tab=absence", Icon: FileHeart, tint: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
];

// ── Who sees what ────────────────────────────────────────────────────────────

/** The menu as the signed-in person sees it. */
export function useNav() {
  const { user } = useAuth();
  const { flags } = useFeatureFlags();
  const isWCOrAdmin = user?.role === "WC" || user?.is_admin === true;
  const isManager = user?.role === "WC" || user?.role === "CC";

  const allowed = (item: NavItem) => {
    if (item.adminOnly && !isWCOrAdmin) return false;
    if (item.managersOnly && !isManager) return false;
    if (item.featureKey && !isWCOrAdmin && !flags[item.featureKey]) return false;
    return true;
  };

  return {
    isManager,
    groups: NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter(allowed) }))
      .filter((g) => g.items.length > 0),
    account: ACCOUNT_ITEMS.filter(allowed),
    actions: isManager ? MANAGER_ACTIONS : CREW_ACTIONS,
  };
}

const ALL_PAGES: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...ACCOUNT_ITEMS];

/** The page a path belongs to — "/people/123" is People. */
export function pageFor(pathname: string): NavItem | undefined {
  if (pathname === "/") return ALL_PAGES[0];
  return ALL_PAGES
    .filter((p) => p.path !== "/" && (pathname === p.path || pathname.startsWith(p.path + "/")))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

export function isActivePath(pathname: string, path: string): boolean {
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");
}
