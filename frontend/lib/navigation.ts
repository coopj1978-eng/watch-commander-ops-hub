import {
  BarChart2,
  BookMarked,
  Calendar,
  CalendarPlus,
  CheckSquare,
  ClipboardList,
  FileCheck,
  FileHeart,
  FileText,
  Flame,
  GraduationCap,
  House,
  KanbanSquare,
  Link2,
  Library,
  ListChecks,
  Megaphone,
  NotebookPen,
  Phone,
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

export type NavBadgeKey = "tasks" | "people" | "bulletins" | "requests";

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Other words ⌘K search matches on. */
  keywords?: string;
  /** Hidden when this feature is switched off (a WC or admin still sees it). */
  featureKey?: keyof FeatureFlags;
  /** WC, CC or the admin. */
  managersOrAdmin?: boolean;
  /** WC/CC only. */
  managersOnly?: boolean;
  /** Its single-key shortcut (see useKeyboardShortcuts). */
  shortcut?: string;
  /** Live count shown next to it (see useNavBadges). */
  badge?: NavBadgeKey;
  /**
   * Pages that sit under this one menu entry as tabs (the Library). Each keeps
   * its own address and its own firefighter switch; the entry shows while any
   * of them is on.
   */
  tabs?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * The Library (Nov 2026): Guides, Links and Documents were three menu entries
 * for one kind of thing — "where do I look that up" — so they share one.
 */
export const LIBRARY_TABS: NavItem[] = [
  { name: "Guides",    path: "/guides",   icon: ListChecks, featureKey: "guides",   keywords: "how to process procedure steps defect report sickness overtime" },
  { name: "Links",     path: "/links",    icon: Link2,      featureKey: "links",    keywords: "systems websites kronos itrent sharepoint intranet pdr hfsv" },
  { name: "Documents", path: "/policies", icon: FileText,   featureKey: "policies", keywords: "docs policies guidance resources" },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    items: [
      { name: "Home",     path: "/",         icon: House,         shortcut: "D", keywords: "dashboard needs you" },
      { name: "Shift",    path: "/handover", icon: ClipboardList, featureKey: "handover",  shortcut: "H", keywords: "handover crewing board riding rotas detachments detached duty canteen" },
      { name: "Tasks",    path: "/tasks",    icon: CheckSquare,   featureKey: "tasks",     shortcut: "T", badge: "tasks", keywords: "shift board checks to do" },
      { name: "Calendar", path: "/calendar", icon: Calendar,      featureKey: "calendar",  keywords: "events leave rota" },
    ],
  },
  {
    label: "Crew",
    items: [
      { name: "People",      path: "/people",      icon: Users,         featureKey: "people", shortcut: "P", badge: "people", keywords: "crew staff firefighters profiles" },
      { name: "Requests",    path: "/requests",    icon: FileCheck,     featureKey: "requests", badge: "requests", keywords: "flexi day head for head h4h swap annual leave move kronos authorise decline records" },
      { name: "Bulletins",   path: "/bulletins",   icon: Megaphone,     featureKey: "bulletins", badge: "bulletins", keywords: "news announcements messages" },
      { name: "Training",    path: "/training",    icon: GraduationCap, featureKey: "training", keywords: "courses skills certificates" },
    ],
  },
  {
    label: "Station",
    items: [
      { name: "Targets",    path: "/targets",    icon: Target,     featureKey: "targets", shortcut: "G", keywords: "hfsv community multi-story performance" },
      { name: "Reports",    path: "/reports",    icon: BarChart2,  featureKey: "reports", keywords: "quarterly report export csv" },
      { name: "Hydrants",   path: "/hydrants",   icon: Flame,      featureKey: "hydrants", keywords: "hydrant routes faults" },
      { name: "J4 Checks",  path: "/equipment",  icon: Truck,      featureKey: "equipment", keywords: "equipment appliance defects j4 board missing" },
      { name: "Contacts",   path: "/contacts",   icon: Phone,      featureKey: "contacts", keywords: "phone numbers telephone control staffing stations call" },
      { name: "Library",    path: "/library",    icon: Library,    tabs: LIBRARY_TABS, keywords: "guides links documents docs look up" },
      { name: "Watch references", path: "/references", icon: BookMarked, featureKey: "references", keywords: "references monthly quarterly annual reference holder" },
    ],
  },
];

/** Under your name: the sidebar's account menu, and the phone's "More" sheet. */
export const ACCOUNT_ITEMS: NavItem[] = [
  { name: "My profile", path: "/profile",  icon: UserCircle, keywords: "me account skills toil" },
  { name: "Settings",   path: "/settings", icon: Settings,   keywords: "appearance dark mode theme" },
  { name: "Admin",      path: "/admin",    icon: ShieldCheck, managersOrAdmin: true, keywords: "station setup skills certs dictionaries absence triggers thresholds inspection plans multi-storey care homes activity log users feature switches" },
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
  { label: "Sick line", hint: "Attach your sick line", to: "/?tab=absence", Icon: FileHeart, tint: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
];

// ── Who sees what ────────────────────────────────────────────────────────────

/**
 * Whether the signed-in person may open a menu item. The feature switches
 * (Admin → Feature management) only apply to firefighters (FF and RO): a WC,
 * CC or the admin always sees everything (Nov 2026 — John: phase the app in
 * for firefighters, a switch per page).
 */
function useAllowed() {
  const { user } = useAuth();
  const { flags } = useFeatureFlags();
  const isManager = user?.role === "WC" || user?.role === "CC";
  const seesAll = isManager || user?.is_admin === true;

  const allowed = (item: NavItem): boolean => {
    if (item.tabs) return item.tabs.some(allowed);
    if (item.managersOrAdmin && !isManager && !user?.is_admin) return false;
    if (item.managersOnly && !isManager) return false;
    if (item.featureKey && !seesAll && !flags[item.featureKey]) return false;
    return true;
  };
  return { allowed, isManager };
}

/**
 * Can this person open the page at `path`? For links on other screens (Home's
 * shortcuts, "Crewing →"…), so a page that's switched off isn't offered.
 */
export function useCanOpen() {
  return useNav().opens;
}

/** The menu as the signed-in person sees it. */
export function useNav() {
  const { allowed, isManager } = useAllowed();
  const opens = (to: string) => {
    const page = pageFor(to.split(/[?#]/)[0]);
    return !page || allowed(page);
  };

  return {
    isManager,
    allowed,
    groups: NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter(allowed) }))
      .filter((g) => g.items.length > 0),
    account: ACCOUNT_ITEMS.filter(allowed),
    // Quick-add only offers pages this person can open.
    actions: (isManager ? MANAGER_ACTIONS : CREW_ACTIONS).filter((a) => opens(a.to)),
    opens,
  };
}

const ALL_PAGES: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...ACCOUNT_ITEMS];
/** Every address a person can land on, tabs included — each with its own switch. */
const ALL_ADDRESSES: NavItem[] = ALL_PAGES.flatMap((p) => [p, ...(p.tabs ?? [])]);

const under = (pathname: string, path: string) => pathname === path || pathname.startsWith(path + "/");

/**
 * The page a path belongs to — "/people/123" is People, "/links" is Links
 * (a tab of the Library). This is the one whose switch decides who may open it.
 */
export function pageFor(pathname: string): NavItem | undefined {
  if (pathname === "/") return ALL_PAGES[0];
  return ALL_ADDRESSES
    .filter((p) => p.path !== "/" && under(pathname, p.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

/** The menu entry a path sits under — "/links" is the Library. For the title bar. */
export function menuEntryFor(pathname: string): NavItem | undefined {
  const page = pageFor(pathname);
  return ALL_PAGES.find((p) => p === page || p.tabs?.includes(page as NavItem)) ?? page;
}

export function isActivePath(pathname: string, path: string): boolean {
  if (path === "/") return pathname === "/";
  if (under(pathname, path)) return true;
  // A menu entry with tabs is lit on any of its tabs.
  const tabs = ALL_PAGES.find((p) => p.path === path)?.tabs;
  return !!tabs?.some((t) => under(pathname, t.path));
}
