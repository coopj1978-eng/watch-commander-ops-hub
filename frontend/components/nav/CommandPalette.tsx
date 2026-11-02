import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, Keyboard, Moon, Search, Sun, type LucideIcon } from "lucide-react";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { pageFor, useNav } from "@/lib/navigation";
import { useNavBadges, type NavBadge } from "@/lib/navBadges";
import { useThemeMode } from "../ThemeSwitcher";
import { NavCount } from "./NavBadge";

// ──────────────────────────────────────────────────────────────────────────────
// ⌘K — one box to get anywhere (Nov 2026). Type a page, a person's name or
// something to add: "jor" finds Jordan's profile, "hand" the handover note,
// "dark" switches the theme. Arrow keys and Enter, or tap. Empty, it shows
// where you've been lately and the things people add most.
// Opens with ⌘K / Ctrl+K or "/" anywhere, the sidebar's Search, or the
// search button on phones.
// ──────────────────────────────────────────────────────────────────────────────

const RECENT_KEY = "recent-pages";
const MAX_RECENT = 4;

/** Remember a visited page for the palette's "Recent" list. */
export function rememberPage(pathname: string) {
  const page = pageFor(pathname);
  if (!page) return;
  try {
    const list: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    const next = [page.path, ...list.filter((p) => p !== page.path)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private window or storage blocked — the list just stays empty.
  }
}

function recentPaths(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

interface Entry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon?: LucideIcon;
  /** Person rows show initials instead of an icon. */
  initials?: string;
  shortcut?: string;
  badge?: NavBadge;
  run: () => void;
}

/** 0 = name starts with it, 1 = a word in the name does, 2 = matched elsewhere, -1 = no match. */
function score(e: Entry, q: string): number {
  const label = e.label.toLowerCase();
  if (label.startsWith(q)) return 0;
  if (label.split(/[\s-]+/).some((w) => w.startsWith(q))) return 1;
  const hay = `${label} ${e.hint ?? ""} ${e.keywords ?? ""}`.toLowerCase();
  return q.split(/\s+/).every((t) => hay.includes(t)) ? 2 : -1;
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

export function CommandPalette({ open, onOpenChange, onShowShortcuts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
}) {
  const navigate = useNavigate();
  const { groups, account, other, actions, isManager } = useNav();
  const badges = useNavBadges();
  const { isDark, toggle } = useThemeMode();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K anywhere; "/" when you're not typing in a box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      const t = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable;
      if (e.key === "/" && !typing && !open && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  // The crew, for WC/CC (same list the task board uses, so usually cached).
  const { data: people } = useQuery({
    queryKey: ["people-for-tasks"],
    queryFn: async () => (await backend.profile.listWithUsers({ limit: 500 })).people ?? [],
    enabled: open && isManager,
    staleTime: 5 * 60 * 1000,
  });

  const go = (to: string) => () => {
    onOpenChange(false);
    navigate(to);
  };

  const entries = useMemo(() => {
    const pages: Entry[] = [...groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), ...account.map((i) => ({ ...i, group: "You" })), ...other.map((i) => ({ ...i, group: "Station" }))]
      .map((p) => ({
        id: `page:${p.path}`,
        group: "Go to",
        label: p.name,
        hint: p.group,
        keywords: p.keywords,
        icon: p.icon,
        shortcut: p.shortcut,
        badge: p.badge ? badges[p.badge] : undefined,
        run: go(p.path),
      }));

    const adds: Entry[] = actions.map((a) => ({
      id: `add:${a.label}`,
      group: "Add",
      label: a.label,
      hint: a.hint,
      keywords: "new add create",
      icon: a.Icon,
      run: go(a.to),
    }));

    const dos: Entry[] = [
      {
        id: "do:theme",
        group: "Do",
        label: isDark ? "Switch to light mode" : "Switch to dark mode",
        keywords: "theme dark light night appearance",
        icon: isDark ? Sun : Moon,
        run: () => toggle(),
      },
      {
        id: "do:shortcuts",
        group: "Do",
        label: "Keyboard shortcuts",
        keywords: "keys help hotkeys",
        icon: Keyboard,
        shortcut: "?",
        run: () => {
          onOpenChange(false);
          onShowShortcuts();
        },
      },
    ];

    const crew: Entry[] = (people ?? [])
      .filter((p) => p.user.is_active !== false && p.user.name)
      .map((p) => ({
        id: `person:${p.user.id}`,
        group: "People",
        label: p.user.name,
        hint: [p.user.rank || p.user.role, p.user.watch_unit && `${p.user.watch_unit} Watch`].filter(Boolean).join(" · "),
        keywords: p.user.email,
        initials: initialsOf(p.user.name),
        run: go(`/people/${p.user.id}`),
      }));

    const q = query.trim().toLowerCase();
    if (!q) {
      const recent = recentPaths()
        .map((path) => pages.find((p) => p.id === `page:${path}`))
        .filter((p): p is Entry => !!p)
        .slice(0, MAX_RECENT)
        .map((p) => ({ ...p, id: `recent:${p.id}`, group: "Recent" }));
      return [...recent, ...adds, ...pages, ...dos];
    }

    const rank = (list: Entry[], limit = 50) =>
      list
        .map((e) => ({ e, s: score(e, q) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => a.s - b.s)
        .slice(0, limit)
        .map((x) => x.e);

    return [...rank(pages), ...rank(crew, 8), ...rank(adds), ...rank(dos)];
    // `go` is recreated each render but only closes over navigate/onOpenChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, groups, account, other, actions, people, badges, isDark]);

  useEffect(() => setActive(0), [query]);

  // Keep the highlighted row in view while arrowing.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(entries.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      entries[active]?.run();
    }
  };

  let lastGroup = "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-3 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 md:top-[12vh]",
            "overflow-hidden rounded-2xl border border-border/70 bg-popover text-popover-foreground",
            "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:duration-150",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
          )}
          onKeyDown={onKeyDown}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">Search people, pages and actions</Dialog.Description>

          <div className="flex items-center gap-3 border-b border-border/70 px-4">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isManager ? "Search people, pages and actions…" : "Search pages and actions…"}
              className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={entries[active] ? `palette-${active}` : undefined}
            />
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">esc</kbd>
          </div>

          <div ref={listRef} id="palette-list" role="listbox" className="max-h-[min(62vh,440px)] overflow-y-auto overscroll-contain p-2">
            {entries.length === 0 && (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                Nothing matches “{query.trim()}”.
              </p>
            )}
            {entries.map((e, i) => {
              const heading = e.group !== lastGroup ? e.group : null;
              lastGroup = e.group;
              const Icon = e.icon;
              const isActive = i === active;
              return (
                <div key={e.id}>
                  {heading && (
                    <div className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 first:pt-1">
                      {heading}
                    </div>
                  )}
                  <button
                    type="button"
                    id={`palette-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => !isActive && setActive(i)}
                    onClick={e.run}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      isActive ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-background text-muted-foreground",
                        e.initials && "rounded-full border-0 bg-brand/10 font-mono text-[11px] font-semibold text-brand dark:bg-brand-bright/15 dark:text-brand-bright",
                        isActive && !e.initials && "text-foreground",
                      )}
                    >
                      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : e.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{e.label}</span>
                      {e.hint && <span className="block truncate text-xs text-muted-foreground">{e.hint}</span>}
                    </span>
                    {e.badge && <NavCount badge={e.badge} />}
                    {e.shortcut && !isActive && (
                      <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
                        {e.shortcut}
                      </kbd>
                    )}
                    {isActive && <CornerDownLeft className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="hidden items-center gap-4 border-t border-border/70 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
            <span><kbd className="font-mono">↑↓</kbd> move</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
            <span className="ml-auto"><kbd className="font-mono">⌘K</kbd> anywhere</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
