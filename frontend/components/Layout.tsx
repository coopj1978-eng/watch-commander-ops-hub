import { useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarNav from "./SidebarNav";
import TopBar from "./TopBar";
import PageContainer from "./PageContainer";
import { MobileBottomNav } from "./MobileBottomNav";
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

// ── Layout ────────────────────────────────────────────────────────────────────

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(
    () => localStorage.getItem("sidebar-expanded") === "true"
  );

  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  const toggleExpanded = () => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-expanded", String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen">
      <SidebarNav
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        expanded={sidebarExpanded}
        onToggleExpand={toggleExpanded}
      />

      {/* Mobile backdrop — tapping it closes the sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <PageContainer sidebarExpanded={sidebarExpanded}>
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <Outlet />
      </PageContainer>

      <MobileBottomNav />

      {/* Global keyboard shortcuts help modal */}
      <ShortcutsHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
