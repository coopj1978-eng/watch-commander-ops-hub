import { useState } from "react";
import { useAuth } from "@/App";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import backend from "@/lib/backend";
import {
  Bell, Stethoscope, AlertCircle, Info, CheckCheck, ShieldAlert,
  ClipboardList, Search, X as XIcon, Megaphone,
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
import type { notification } from "@/client";
import { latestAbsencePerPerson, useTodaysAbsences } from "@/lib/absences";
import { shiftDisplay } from "@/lib/shiftRota";
import { pageFor } from "@/lib/navigation";

interface TopBarProps {
  /** Opens ⌘K search. */
  onSearch: () => void;
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

  const absencesQ = useTodaysAbsences(!!watch);

  const total = profilesQ.data?.total ?? 0;
  const absences = [...latestAbsencePerPerson(absencesQ.data?.absences ?? []).values()];
  const watchUserIds = new Set((profilesQ.data?.profiles ?? []).map(p => p.user_id));
  const watchAbsences = watch ? absences.filter(a => watchUserIds.has(a.firefighter_id)) : absences;
  const off = watchAbsences.length;
  const on  = Math.max(0, total - off);

  // From the watch's own rota: on a shift, off until the next, rest or leave.
  const shift = shiftDisplay(watch);

  if (!watch) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-muted/60 text-xs">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
      <span className="font-medium text-foreground">{watch} Watch</span>
      <span className="text-muted-foreground">·</span>
      {shift && (
        <>
          <span className="text-foreground">{shift.main}</span>
          {shift.sub && <span className="font-mono text-muted-foreground">{shift.sub}</span>}
          <span className="text-muted-foreground">·</span>
        </>
      )}
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
// TopBar
// ──────────────────────────────────────────────────────────────────────────────

export default function TopBar({ onSearch }: TopBarProps) {
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

  // ── Derived: page title + dashboard flag ──────────────────────────────────
  const page = pageFor(location.pathname);
  const isDashboard = location.pathname === "/";

  // Navigation and your account live in the sidebar (desktop) and the tab
  // bar's More sheet (phones), so the bar keeps to where you are, search and
  // notifications.
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 py-2.5 bg-background/80 backdrop-blur-md border-b border-border print:hidden">
      {/* ── Left: the page you're on ───────────────────────────────────── */}
      <div className="flex items-center gap-2.5 min-w-0">
        {page && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/70 text-foreground/80 md:hidden" aria-hidden>
            <page.icon className="h-4 w-4" />
          </span>
        )}
        <span className="font-semibold text-foreground truncate text-base md:text-sm">{page?.name ?? "Ops"}</span>
      </div>

      {/* ── Watch pill — hidden on dashboard (OperationalStatusBar covers) ─ */}
      {!isDashboard && <WatchShiftPill />}

      {/* Flex spacer pushes the right cluster to the end */}
      <div className="flex-1" />

      {/* ── Right: search + bell ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Search — a box on desktop, an icon on phones. Opens ⌘K. */}
        <button
          type="button"
          onClick={onSearch}
          className="hidden md:flex h-8 w-64 items-center gap-2 rounded-lg border border-transparent bg-muted/60 px-2.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1 text-left truncate">Search people, pages, actions…</span>
          <kbd className="font-mono text-[10px] text-muted-foreground/70">⌘K</kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 rounded-lg hover:bg-muted"
          onClick={onSearch}
          aria-label="Search"
        >
          <Search className="h-[18px] w-[18px]" />
        </Button>

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
      </div>
    </header>
  );
}
