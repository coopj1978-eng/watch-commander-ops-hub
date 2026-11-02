import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, KeyRound, LogOut, Moon, MoreHorizontal, Search, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/App";
import { isActivePath, useNav, type NavItem } from "@/lib/navigation";
import { useNavBadges, type NavBadge } from "@/lib/navBadges";
import { Switch } from "@/components/ui/switch";
import { useThemeMode } from "./ThemeSwitcher";
import { NavCount, NavDot } from "./nav/NavBadge";

// ──────────────────────────────────────────────────────────────────────────────
// Phones (Nov 2026): four tabs for the pages used every shift, and "More" — a
// sheet with everything else, search, and your account. It replaces the old
// ☰ drawer, which listed the same pages a second time.
// ──────────────────────────────────────────────────────────────────────────────

const MANAGER_TABS = ["/", "/people", "/tasks", "/handover"];
const CREW_TABS = ["/", "/tasks", "/calendar", "/handover"];

interface MobileBottomNavProps {
  onSearch: () => void;
  onChangePassword: () => void;
}

export function MobileBottomNav({ onSearch, onChangePassword }: MobileBottomNavProps) {
  const { pathname } = useLocation();
  const { groups, isManager } = useNav();
  const badges = useNavBadges();
  const [moreOpen, setMoreOpen] = useState(false);

  const all = groups.flatMap((g) => g.items);
  const tabPaths = isManager ? MANAGER_TABS : CREW_TABS;
  const tabs = tabPaths.map((p) => all.find((i) => i.path === p)).filter((i): i is NavItem => !!i);
  const rest = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !tabPaths.includes(i.path)) }))
    .filter((g) => g.items.length > 0);

  const onTab = tabs.some((t) => isActivePath(pathname, t.path));
  // Something under More wants attention → a dot on More.
  const moreBadge = rest.flatMap((g) => g.items).map((i) => i.badge && badges[i.badge]).find(Boolean) || undefined;

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden print:hidden",
          "border-t border-border/60 bg-background/90 backdrop-blur-xl",
          "pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]",
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-stretch">
          {tabs.map((item) => {
            const active = isActivePath(pathname, item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? "page" : undefined}
                className="flex flex-1 flex-col items-center justify-center gap-1 focus-visible:outline-none"
              >
                <TabIcon icon={item.icon} active={active} badge={item.badge ? badges[item.badge] : undefined} />
                <TabLabel active={active}>{item.name}</TabLabel>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-current={!onTab ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-1 focus-visible:outline-none"
          >
            <TabIcon icon={MoreHorizontal} active={!onTab || moreOpen} badge={moreBadge} />
            <TabLabel active={!onTab}>More</TabLabel>
          </button>
        </div>
      </nav>

      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        groups={rest}
        onSearch={() => {
          setMoreOpen(false);
          onSearch();
        }}
        onChangePassword={() => {
          setMoreOpen(false);
          onChangePassword();
        }}
      />
    </>
  );
}

function TabIcon({ icon: Icon, active, badge }: { icon: React.ElementType; active: boolean; badge?: NavBadge }) {
  return (
    <span
      className={cn(
        "relative grid h-8 w-14 place-items-center rounded-full transition-all duration-200",
        active ? "bg-brand/10 text-brand dark:bg-brand-bright/15 dark:text-brand-bright" : "text-muted-foreground",
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
      {badge && <NavDot badge={badge} ring="ring-background" className="right-3 top-0.5" />}
    </span>
  );
}

function TabLabel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("text-[11px] leading-none", active ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
      {children}
    </span>
  );
}

function MoreSheet({ open, onOpenChange, groups, onSearch, onChangePassword }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: { label: string; items: NavItem[] }[];
  onSearch: () => void;
  onChangePassword: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { account } = useNav();
  const badges = useNavBadges();
  const { isDark, toggle } = useThemeMode();
  const name = user?.name || "You";
  const role = [user?.role, user?.watch_unit && `${user.watch_unit} Watch`].filter(Boolean).join(" · ");

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const [profile, ...settings] = account;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-border bg-background shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200",
          )}
        >
          <div className="shrink-0 px-4 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" aria-hidden />
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold">More</Dialog.Title>
              <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Close">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Every page, search and your account</Dialog.Description>

            <button
              type="button"
              onClick={onSearch}
              className="mt-3 flex h-11 w-full items-center gap-2.5 rounded-xl bg-muted px-3.5 text-left text-[15px] text-muted-foreground"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search people, pages, actions
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
            {groups.map((g) => (
              <section key={g.label} className="mt-5">
                <h3 className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{g.label}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {g.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item.path);
                    const badge = item.badge ? badges[item.badge] : undefined;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => go(item.path)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex aspect-[5/4] flex-col justify-between rounded-2xl border p-3 text-left transition-colors active:scale-[0.98]",
                          active ? "border-brand/40 bg-brand/5 dark:border-brand-bright/40" : "border-border/70 bg-card hover:bg-muted/60",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-9 w-9 place-items-center rounded-xl",
                            active ? "bg-brand text-brand-foreground" : "bg-muted text-foreground/80",
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <span className="text-[13px] font-medium leading-tight text-foreground">{item.name}</span>
                        {badge && <NavCount badge={badge} className="absolute right-2.5 top-2.5" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="mt-6">
              <h3 className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">You</h3>
              <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card">
                {profile && (
                  <button type="button" onClick={() => go(profile.path)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-muted">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand font-mono text-sm font-semibold text-brand-foreground">
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{role} · your profile</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                )}
                {settings.map(({ name: label, path, icon: Icon }) => (
                  <Row key={path} icon={Icon} label={label} onClick={() => go(path)} chevron />
                ))}
                <label className="flex w-full items-center gap-3 px-3.5 py-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground/80">
                    {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </span>
                  <span className="flex-1 text-[15px]">Dark mode</span>
                  <Switch checked={isDark} onCheckedChange={toggle} aria-label="Dark mode" />
                </label>
                <Row icon={KeyRound} label="Change password" onClick={onChangePassword} />
                <Row icon={LogOut} label="Sign out" onClick={signOut} />
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ icon: Icon, label, onClick, chevron }: { icon: React.ElementType; label: string; onClick: () => void; chevron?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-muted">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground/80">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex-1 text-[15px]">{label}</span>
      {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
    </button>
  );
}
