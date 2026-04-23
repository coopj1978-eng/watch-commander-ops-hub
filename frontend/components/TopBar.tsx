import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "@/App";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import backend from "@/lib/backend";
import {
  Bell, Menu, Stethoscope, AlertCircle, Info, CheckCheck, ShieldAlert,
  ClipboardList, Search, ChevronRight, X as XIcon,
  LayoutDashboard, Users, Calendar as CalendarIcon, CheckSquare,
  Target, Navigation, Truck, GraduationCap, UserCircle, FileText,
  BookOpen, Settings as SettingsIcon, ShieldCheck, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ThemeSwitcher from "./ThemeSwitcher";
import type { notification } from "@/client";

// ──────────────────────────────────────────────────────────────────────────────
// Route registry for breadcrumb + jump-to-page search. Kept in sync with
// SidebarNav. When a new page is added, add its entry here so it shows up in
// the search dropdown and gets a sensible breadcrumb label.
// ──────────────────────────────────────────────────────────────────────────────
const ROUTES: { path: string; name: string; icon: React.ElementType }[] = [
  { path: "/",            name: "Dashboard",   icon: LayoutDashboard },
  { path: "/people",      name: "People",      icon: Users },
  { path: "/calendar",    name: "Calendar",    icon: CalendarIcon },
  { path: "/tasks",       name: "Tasks",       icon: CheckSquare },
  { path: "/handover",    name: "Shift",       icon: ClipboardList },
  { path: "/bulletins",   name: "Bulletins",   icon: Megaphone },
  { path: "/targets",     name: "Targets",     icon: Target },
  { path: "/detachments", name: "Detachments", icon: Navigation },
  { path: "/equipment",   name: "J4 Checks",   icon: Truck },
  { path: "/training",    name: "Training",    icon: GraduationCap },
  { path: "/policies",    name: "Docs",        icon: FileText },
  { path: "/resources",   name: "Resources",   icon: BookOpen },
  { path: "/profile",     name: "My Profile",  icon: UserCircle },
  { path: "/settings",    name: "Settings",    icon: SettingsIcon },
  { path: "/admin",       name: "Admin",       icon: ShieldCheck },
];

interface TopBarProps {
  onMenuClick?: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Notification helpers — kept verbatim from the previous TopBar. The whole
// notifications experience (icons, grouping, time-ago formatting) is
// preserved unchanged.
// ──────────────────────────────────────────────────────────────────────────────

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
    case "bulletin_posted":
      return <Megaphone className="h-4 w-4 text-brand shrink-0" />;
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

// ──────────────────────────────────────────────────────────────────────────────
// Breadcrumb + shift helpers
// ──────────────────────────────────────────────────────────────────────────────

function getBreadcrumbLabel(pathname: string): string {
  // Match longest-prefix first — e.g. "/people/123" matches "/people".
  // The root "/" matches "Dashboard" exactly.
  if (pathname === "/") return "Dashboard";
  const match = ROUTES
    .filter(r => r.path !== "/" && pathname.startsWith(r.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.name ?? pathname;
}

function getShiftSpan(): { label: string; time: string } {
  // Matches the app-wide pattern (TopBar / WCCommandStrip / WCShiftWidget).
  const h = new Date().getHours();
  const isDay = h >= 8 && h < 18;
  return {
    label: isDay ? "Day Shift" : "Night Shift",
    time:  isDay ? "08:00–18:00" : "18:00–08:00",
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Watch / shift / duty pill — shown on every page except /dashboard where the
// OperationalStatusBar already surfaces the same info in a bigger form.
// Reuses the existing TanStack queryKeys so no extra network requests.
// ──────────────────────────────────────────────────────────────────────────────

function WatchShiftPill() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";

  const profilesQ = useQuery({
    queryKey: ["wc-profiles", watch],
    queryFn: async () => backend.profile.list({ watch: watch || undefined, limit: 200 }),
    enabled: !!watch,
  });

  const absencesQ = useQuery({
    queryKey: ["wc-absences-today"],
    queryFn: async () =>
      backend.absence.list({
        status: "approved",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
        limit: 200,
      }),
    enabled: !!watch,
  });

  const total = profilesQ.data?.total ?? 0;
  const absences = absencesQ.data?.absences ?? [];
  const watchUserIds = new Set((profilesQ.data?.profiles ?? []).map(p => p.user_id));
  const watchAbsences = watch ? absences.filter(a => watchUserIds.has(a.firefighter_id)) : absences;
  const off = watchAbsences.length;
  const on  = Math.max(0, total - off);

  const shift = getShiftSpan();

  if (!watch) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-muted/60 text-xs">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
      <span className="font-medium text-foreground">{watch} Watch</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-mono text-muted-foreground">{shift.time}</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-mono text-foreground">
        {on}
        <span className="text-muted-foreground"> on / </span>
        {off}
        <span className="text-muted-foreground"> off</span>
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Jump-to-page search — client-side route switcher. Input filters the nav
// registry; click or Enter navigates. Wiring to real full-text search across
// crew / tasks / docs is a future step; this is deliberately scoped to pages
// only so the "nothing happens" cosmetic-only pattern is avoided.
// ──────────────────────────────────────────────────────────────────────────────

function JumpSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Cmd/Ctrl+K focuses the input from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ROUTES;
    return ROUTES.filter(r => r.name.toLowerCase().includes(q));
  }, [query]);

  const go = (path: string) => {
    navigate(path);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Jump to page…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) go(results[0].path);
            if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
          }}
          className="h-8 w-56 pl-8 pr-10 rounded text-xs bg-muted/60 border border-transparent
                     focus:bg-background focus:border-border focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-indigo-400/40
                     placeholder:text-muted-foreground"
          aria-label="Jump to page"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/60 pointer-events-none">
          ⌘K
        </kbd>
      </div>

      {open && results.length > 0 && (
        <div className="absolute right-0 top-[calc(100%+4px)] w-64 rounded-md border border-border bg-popover shadow-lg z-50 overflow-hidden">
          <ul role="listbox">
            {results.slice(0, 10).map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.path}>
                  <button
                    type="button"
                    onClick={() => go(r.path)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-muted/60 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 font-medium text-foreground">{r.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{r.path}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TopBar
// ──────────────────────────────────────────────────────────────────────────────

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Notifications — verbatim from previous TopBar ──────────────────────────
  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => backend.notification.list(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useQuery({
    queryKey: ["notifications-refresh"],
    queryFn: async () => {
      const result = await backend.notification.refresh();
      if (result.generated > 0) {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      return result;
    },
    refetchInterval: 5 * 60_000,
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

  // Mobile drawer state — on small screens the Radix DropdownMenu feels
  // cramped so we render a Dialog-as-sheet (full viewport height, right-
  // docked) instead. Desktop still uses the DropdownMenu for the nicer
  // anchored-dropdown feel and smaller footprint.
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNotificationClick = (n: notification.Notification) => {
    if (!n.read) markReadMutation.mutate(n.id);
    if (n.link) navigate(n.link);
    setMobileOpen(false); // auto-close the mobile sheet after selecting
  };

  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unread_count ?? 0;
  const { today, thisWeek, older } = groupNotifications(notifications);

  // Drawer contents — shared between desktop dropdown + mobile sheet so the
  // two renderings stay in lockstep. Rendered twice in the JSX; each tree is
  // portaled separately (DropdownMenuContent / DialogContent both portal to
  // <body>) so there's no DOM duplication concern.
  //
  // `onMobileClose` is only supplied by the mobile sheet path — when present,
  // we render a visible ✕ in the header. Desktop dropdown closes on
  // click-outside / Escape so no explicit button needed.
  const renderNotificationPanel = (onMobileClose?: () => void) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close notifications"
              className="h-7 w-7 -ml-1 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up ✓"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification list — bounded on desktop (dropdown), flex-1 on mobile
          (fills the sheet). max-h keyed off a CSS var so both contexts work. */}
      <div className="flex-1 min-h-0 overflow-y-auto md:max-h-[420px]">
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
                      className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0 ${!n.read ? "bg-brand/5" : ""} ${n.link ? "cursor-pointer" : "cursor-default"}`}
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
                          <span className="text-[10px] text-brand mt-1 inline-block">
                            Tap to view →
                          </span>
                        )}
                      </div>
                      {!n.read && (
                        <div className="h-2 w-2 rounded-full bg-brand shrink-0 mt-2" />
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
        <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">{notifications.length} total</span>
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </>
  );

  // Bell button — rendered twice (mobile + desktop trigger), identical
  // except for how the click is wired up. Kept as a render fn to avoid
  // duplicating the aria-label / badge logic.
  const renderBellButton = (onClick?: () => void) => (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9 rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`Notifications, ${unreadCount} unread`}
      onClick={onClick}
    >
      <Bell className={`h-4.5 w-4.5 ${unreadCount > 0 ? "text-foreground" : "text-muted-foreground"}`} />
      {unreadCount > 0 && (
        <Badge
          className="absolute -top-1 -right-1 h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center bg-red-500 text-white text-[10px] font-mono"
          aria-label={`${unreadCount} unread notifications`}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </Badge>
      )}
    </Button>
  );

  // ── Derived: breadcrumb + dashboard flag ──────────────────────────────────
  const currentPageLabel = getBreadcrumbLabel(location.pathname);
  const isDashboard = location.pathname === "/";

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 py-2.5 bg-background/80 backdrop-blur-md border-b border-border print:hidden">
      {/* ── Left: hamburger + breadcrumb ───────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — only shown on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 rounded hover:bg-muted shrink-0"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Breadcrumb — "Ops / {CurrentPage}" */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            Ops
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" aria-hidden />
          <span className="font-semibold text-foreground truncate">{currentPageLabel}</span>
        </nav>
      </div>

      {/* ── Watch pill — hidden on dashboard (OperationalStatusBar covers) ─ */}
      {!isDashboard && <WatchShiftPill />}

      {/* Flex spacer pushes the right cluster to the end */}
      <div className="flex-1" />

      {/* ── Right: search + theme + bell + avatar ──────────────────────── */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <JumpSearch />

        <ThemeSwitcher />

        {/* Notification Bell — two surfaces sharing the same panel contents:
            • Desktop (md+): Radix DropdownMenu anchored to the bell — smaller
              footprint, feels like a proper dropdown
            • Mobile: Dialog rendered as a right-docked full-height sheet —
              readable at 03:00 on a phone screen, proper focus trap, escape
              to close, doesn't overflow the viewport edge */}
        <div className="hidden md:inline-flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {renderBellButton()}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-96 p-0 flex flex-col"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {renderNotificationPanel()}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="md:hidden">
          {renderBellButton(() => setMobileOpen(true))}
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogContent
              showCloseButton={false}
              className="fixed top-0 right-0 left-auto translate-x-0 translate-y-0 h-[100dvh] w-full max-w-[calc(100%-2rem)] sm:max-w-sm rounded-none border-0 border-l p-0 gap-0 flex flex-col data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
            >
              {/* Visually-hidden title for Radix a11y — the shared panel
                  header already renders a visible "Notifications" heading,
                  so this is just for screen readers (Dialog requires a
                  title). */}
              <DialogTitle className="sr-only">Notifications</DialogTitle>
              {renderNotificationPanel(() => setMobileOpen(false))}
            </DialogContent>
          </Dialog>
        </div>

        {/* User menu — preserved verbatim */}
        <div className="flex items-center gap-2 pl-1.5 md:pl-2 border-l border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 px-1.5 md:px-2 rounded hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded bg-brand text-brand-foreground flex items-center justify-center font-mono font-semibold text-xs shrink-0">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">{user?.name?.split(" ")[0] || "User"}</span>
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
