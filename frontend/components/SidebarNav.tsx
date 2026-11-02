import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronsUpDown,
  Keyboard,
  KeyRound,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Search,
  Sun,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/App";
import { isActivePath, useNav, type NavItem } from "@/lib/navigation";
import { useNavBadges, type NavBadge } from "@/lib/navBadges";
import { useThemeMode } from "./ThemeSwitcher";
import { NavCount, NavDot } from "./nav/NavBadge";

// ──────────────────────────────────────────────────────────────────────────────
// Desktop sidebar (Nov 2026 redesign). A narrow icon rail that opens out to
// show labels while the pointer is over it — no tooltips to hunt through —
// and can be kept open with the pin (or "["). Live counts sit beside Tasks,
// People and Bulletins. Your account, settings and theme live in the menu
// under your name at the bottom. Phones use the tab bar and its "More" sheet.
// ──────────────────────────────────────────────────────────────────────────────

const PEEK_DELAY_MS = 140;

interface SidebarNavProps {
  /** Kept open with labels (and the page moves over to make room). */
  expanded?: boolean;
  onToggleExpand?: () => void;
  onSearch: () => void;
  onShowShortcuts: () => void;
  onChangePassword: () => void;
}

export default function SidebarNav({
  expanded = false,
  onToggleExpand,
  onSearch,
  onShowShortcuts,
  onChangePassword,
}: SidebarNavProps) {
  const { pathname } = useLocation();
  const { groups } = useNav();
  const badges = useNavBadges();

  // Opened out over the page while the pointer (or keyboard focus) is on the rail.
  const [peek, setPeek] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const open = expanded || peek || menuOpen;

  const startPeek = () => {
    if (expanded) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPeek(true), PEEK_DELAY_MS);
  };
  const endPeek = () => {
    window.clearTimeout(timer.current);
    setPeek(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden h-screen flex-col md:flex print:hidden",
        "bg-neutral-900 dark:bg-neutral-950 border-r border-white/5",
        "transition-[width,box-shadow] duration-200 ease-out",
        open ? "w-56" : "w-20",
        // Peeking: floats over the page instead of pushing it.
        open && !expanded && "shadow-[8px_0_40px_-8px_rgba(0,0,0,0.45)]",
      )}
      onMouseEnter={startPeek}
      onMouseLeave={endPeek}
      // Keyboard only: a click also focuses, and the pointer handles that.
      onFocus={(e) => e.target.matches(":focus-visible") && startPeek()}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) endPeek();
      }}
      aria-label="Main navigation"
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div className={cn("flex h-16 shrink-0 items-center gap-3", open ? "px-4" : "justify-center")}>
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-bright text-neutral-900",
            "font-mono text-sm font-semibold tracking-wide",
          )}
        >
          WC
        </div>
        {open && (
          <div className="min-w-0 animate-in fade-in-0 duration-200">
            <p className="truncate text-[13px] font-semibold leading-tight text-white">Watch Commander</p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase leading-tight tracking-[0.08em] text-white/40">
              B10 Springburn
            </p>
          </div>
        )}
      </div>

      {/* ── Search ────────────────────────────────────────────────────── */}
      <div className={cn("shrink-0 pb-2", open ? "px-3" : "flex justify-center")}>
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search people, pages and actions"
          className={cn(
            "flex items-center rounded-lg text-white/50 transition-colors",
            "bg-white/[0.06] hover:bg-white/10 hover:text-white/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-bright",
            open ? "h-9 w-full gap-2.5 px-3" : "h-10 w-12 justify-center",
          )}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          {open && (
            <>
              <span className="flex-1 truncate text-left text-[13px]">Search</span>
              <kbd className="rounded border border-white/10 px-1.5 py-px font-mono text-[10px] text-white/40">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* ── Menu ──────────────────────────────────────────────────────── */}
      <nav className={cn("scrollbar-none flex w-full flex-1 flex-col overflow-y-auto pb-2", open ? "px-3" : "items-center px-3")}>
        {groups.map((group, gi) => (
          <Fragment key={group.label}>
            {open ? (
              <div className="px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35" aria-hidden="true">
                {group.label}
              </div>
            ) : (
              gi > 0 && <div className="mx-auto my-2 h-px w-8 bg-white/10" aria-hidden="true" />
            )}
            {group.items.map((item) => (
              <SidebarLink
                key={item.path}
                item={item}
                open={open}
                active={isActivePath(pathname, item.path)}
                badge={item.badge ? badges[item.badge] : undefined}
              />
            ))}
          </Fragment>
        ))}
      </nav>

      {/* ── Keep open + account ───────────────────────────────────────── */}
      <div className={cn("shrink-0 border-t border-white/5 p-3", !open && "flex flex-col items-center")}>
        <button
          type="button"
          onClick={() => {
            endPeek();
            onToggleExpand?.();
          }}
          aria-label={expanded ? "Collapse the menu" : "Keep the menu open"}
          title={`${expanded ? "Collapse" : "Keep open"}  [`}
          className={cn(
            "mb-1 flex items-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-bright",
            open ? "h-8 w-full gap-3 px-3" : "h-9 w-12 justify-center",
          )}
        >
          {expanded ? (
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : open ? (
            <Pin className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {open && (
            <>
              <span className="flex-1 text-left text-[12px]">{expanded ? "Collapse" : "Keep open"}</span>
              <kbd className="font-mono text-[10px] text-white/30">[</kbd>
            </>
          )}
        </button>

        <AccountMenu
          open={open}
          onOpenChange={setMenuOpen}
          onShowShortcuts={onShowShortcuts}
          onChangePassword={onChangePassword}
        />
      </div>
    </aside>
  );
}

function SidebarLink({ item, open, active, badge }: {
  item: NavItem;
  open: boolean;
  active: boolean;
  badge?: NavBadge;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      aria-current={active ? "page" : undefined}
      aria-label={open ? undefined : badge ? `${item.name}, ${badge.hint}` : item.name}
      className={cn(
        "group relative flex shrink-0 items-center rounded-lg transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-bright",
        open ? "h-9 w-full gap-3 px-3" : "h-11 w-12 justify-center",
        active ? "bg-white/[0.09] text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
        active && "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-brand-bright",
      )}
    >
      <span className="relative">
        <Icon
          className={cn("shrink-0", open ? "h-[18px] w-[18px]" : "h-5 w-5", active && "text-brand-bright")}
          aria-hidden="true"
        />
        {!open && badge && <NavDot badge={badge} className="-right-1.5 -top-1" />}
      </span>
      {open && (
        <>
          <span className="flex-1 truncate text-[13px] font-medium">{item.name}</span>
          {badge ? (
            <NavCount badge={badge} on="dark" />
          ) : item.shortcut ? (
            <kbd className="font-mono text-[10px] text-white/30 opacity-0 transition-opacity group-hover:opacity-100">
              {item.shortcut}
            </kbd>
          ) : null}
        </>
      )}
    </Link>
  );
}

function AccountMenu({ open, onOpenChange, onShowShortcuts, onChangePassword }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
  onChangePassword: () => void;
}) {
  const { user, signOut } = useAuth();
  const { account } = useNav();
  const { isDark, toggle } = useThemeMode();
  const name = user?.name || "You";
  const role = [user?.role, user?.watch_unit && `${user.watch_unit} Watch`].filter(Boolean).join(" · ");

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Your account"
          className={cn(
            "flex items-center rounded-lg transition-colors hover:bg-white/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-bright",
            open ? "h-12 w-full gap-3 px-2 text-left" : "h-12 w-12 justify-center",
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground font-mono text-xs font-semibold ring-2 ring-white/10">
            {name.charAt(0).toUpperCase()}
          </span>
          {open && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-white">{name}</span>
                <span className="block truncate text-[11px] text-white/45">{role}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/35" aria-hidden="true" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={12}
        className="w-60"
        // Don't hand focus back to the rail — that would open it out again.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {account.map(({ name: label, path, icon: Icon }) => (
          <DropdownMenuItem key={path} asChild>
            <Link to={path}>
              <Icon /> {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggle(); }}>
          {isDark ? <Sun /> : <Moon />} {isDark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onShowShortcuts}>
          <Keyboard /> Keyboard shortcuts <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChangePassword}>
          <KeyRound /> Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
