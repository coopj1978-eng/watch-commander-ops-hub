import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "@/App";
import { useFeatureFlags } from "@/lib/feature-flags";
import { pageFor, useCanOpen } from "@/lib/navigation";
import SidebarNav from "./SidebarNav";
import TopBar from "./TopBar";
import PageContainer from "./PageContainer";
import { MobileBottomNav } from "./MobileBottomNav";
import { QuickAddButton } from "./QuickAddButton";
import PWAInstallPrompt from "./PWAInstallPrompt";
import { CommandPalette, rememberPage } from "./nav/CommandPalette";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { useKeyboardShortcuts, SHORTCUTS } from "@/lib/useKeyboardShortcuts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Keyboard shortcuts help modal ─────────────────────────────────────────────

function ShortcutsHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Keyboard Shortcuts
            <span className="text-xs font-normal text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">?</kbd> to toggle
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="divide-y divide-border/50 -mx-1">
          <div className="flex items-center justify-between px-1 py-2.5">
            <span className="text-sm text-muted-foreground">Search people, pages and actions</span>
            <kbd className="px-2 py-1 rounded bg-muted border border-border text-xs font-mono font-semibold text-foreground">⌘K</kbd>
          </div>
          {SHORTCUTS.filter(s => s.key !== "?").map(s => (
            <div key={s.key} className="flex items-center justify-between px-1 py-2.5">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <kbd className="px-2 py-1 rounded bg-muted border border-border text-xs font-mono font-semibold text-foreground">
                {s.label}
              </kbd>
            </div>
          ))}
          <div className="flex items-center justify-between px-1 py-2.5">
            <span className="text-sm text-muted-foreground">Show / hide this panel</span>
            <kbd className="px-2 py-1 rounded bg-muted border border-border text-xs font-mono font-semibold text-foreground">?</kbd>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Shortcuts are disabled while typing in any input field.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ── Pages that aren't switched on ─────────────────────────────────────────────
// The feature switches phase the app in for firefighters (Nov 2026). A page
// that's off isn't just missing from the menu: following a link or typing its
// address lands here too. WC/CC always see everything.
function PageGate() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { isLoaded } = useFeatureFlags();
  const canOpen = useCanOpen();
  const seesAll = user?.role === "WC" || user?.role === "CC" || user?.is_admin;

  // Wait for the switches before showing a firefighter a page that may be off.
  if (!seesAll && !isLoaded) return null;
  if (canOpen(pathname)) return <Outlet />;

  const name = pageFor(pathname)?.name;
  return (
    <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Lock className="h-5 w-5" />
      </span>
      <h1 className="text-lg font-semibold">{name ? `${name} isn't switched on yet` : "Not switched on yet"}</h1>
      <p className="text-sm text-muted-foreground">Your Watch Commander is bringing the app in a bit at a time. This part will appear in your menu when it's ready.</p>
      <Link to="/" className="mt-1 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">Back to Home</Link>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function Layout() {
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try {
      return localStorage.getItem("sidebar-expanded") === "true";
    } catch {
      return false;
    }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { pathname } = useLocation();

  const toggleExpanded = useCallback(() => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-expanded", String(next));
      } catch {
        // Not remembered — fine.
      }
      return next;
    });
  }, []);

  const shortcutOpts = useMemo(() => ({ onToggleSidebar: toggleExpanded }), [toggleExpanded]);
  const { showHelp, setShowHelp } = useKeyboardShortcuts(shortcutOpts);

  // For ⌘K's "Recent" list.
  useEffect(() => rememberPage(pathname), [pathname]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const showShortcuts = useCallback(() => setShowHelp(true), [setShowHelp]);
  const changePassword = useCallback(() => setChangePasswordOpen(true), []);

  return (
    <div className="min-h-screen">
      <SidebarNav
        expanded={sidebarExpanded}
        onToggleExpand={toggleExpanded}
        onSearch={openSearch}
        onShowShortcuts={showShortcuts}
        onChangePassword={changePassword}
      />

      <PageContainer sidebarExpanded={sidebarExpanded}>
        <TopBar onSearch={openSearch} />
        <PageGate />
      </PageContainer>

      <MobileBottomNav onSearch={openSearch} onChangePassword={changePassword} />

      {/* Phones: "+" for the few things people add on the move */}
      <QuickAddButton />

      {/* PWA install nudge — iOS instructions or Chrome's prompt() helper */}
      <PWAInstallPrompt />

      {/* ⌘K — people, pages and actions */}
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} onShowShortcuts={showShortcuts} />

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

      {/* Global keyboard shortcuts help modal */}
      <ShortcutsHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
