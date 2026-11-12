import { useState, type CSSProperties, type ReactNode } from "react";

import { useUserRole } from "@/lib/rbac";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

// WC home
import { ShiftHero }              from "@/components/ShiftHero";
import { WCAlertBanner }          from "@/components/WCAlertBanner";
import { BulletinsTile }          from "@/components/BulletinsTile";
import { PolicyAcksTile }         from "@/components/PolicyAcksTile";
import { ShiftRunningOrder }      from "@/components/home/ShiftRunningOrder";
import { ComingUp }               from "@/components/home/ComingUp";
import { TargetRings }            from "@/components/home/TargetRings";
import { OurReference }           from "@/components/home/OurReference";
import { PulseTiles }             from "@/components/home/PulseTiles";
import { QuickDial }              from "@/components/home/QuickDial";
import { CrewOnWatchTable }       from "@/components/CrewOnWatchTable";
import { WCSkillsExpiryWidget }   from "@/components/WCSkillsExpiryWidget";

// CC widgets
import { CCDashboard } from "@/components/CCDashboardWidgets";

// Your own balances
import ToilWidget from "@/components/ToilWidget";
import FFH4HBalanceWidget from "@/components/FFH4HBalanceWidget";

// WC H4H widget — reuses the same balance widget since it's user-aware
const WCH4HWidget = FFH4HBalanceWidget;

// ── Role router ───────────────────────────────────────────────────────────────

export default function RoleDashboard() {
  const role = useUserRole();

  // Only WCs land here (App.tsx gives CCs and firefighters their own homes).
  if (role === "WC") return <WatchCommanderDashboard />;
  if (role === "CC") return <CCDashboard />;
  return null;
}

// ── Watch Commander home (Nov 2026 rebuild; bento layout 12 Nov 2026) ─────────
//
// One screen, in the order a WC reads it at the start of a shift:
//   1. the shift now (ShiftHero: clock, countdown, who's riding);
//   2. four "at a glance" tiles: crew, missed checks, the J4 board, the
//      shift board;
//   3. three columns that fill the width of a desktop screen:
//        Needs you (every alert, ranked) · the crew · our reference
//        the shift's running order · the week ahead
//        targets · contacts · your own balances.
//      John (12 Nov 2026): the old two-column page was stretched, with half
//      the screen empty under a short left column.
//   On a phone it is one column: alerts, running order, then the rest.
// Before this, ~17 cards repeated each other: absence triggers showed three
// times, sickness three times, the handover and HFSV twice each, and the
// 14-day inspections, staffing and KPI tiles duplicated the panels above.
// Cards in the rail and the week ahead can be switched off (per device).

const RAIL_CARDS: { id: string; label: string }[] = [
  { id: "pulse",    label: "At a glance — crew, checks, J4 board, shift board" },
  { id: "comingup", label: "Coming up — next 7 days" },
  { id: "targets",  label: "Targets" },
  { id: "reference", label: "Our reference" },
  { id: "crew",     label: "Crew" },
  { id: "contacts", label: "Contacts — the top of the Contacts page" },
  { id: "h4h",      label: "My H4H balance" },
  { id: "toil",     label: "My TOIL" },
  { id: "skills",   label: "Skills & renewals (expiring soon is also in Needs you)" },
];
const HIDDEN_DEFAULTS = ["skills"];
const HIDDEN_KEY = "wc-home-hidden";

function useHiddenCards() {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(HIDDEN_KEY);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* storage blocked or corrupt — use the defaults */ }
    return new Set(HIDDEN_DEFAULTS);
  });
  const save = (next: Set<string>) => {
    setHidden(next);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next])); } catch { /* not saved — fine for this visit */ }
  };
  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id); else next.add(id);
    save(next);
  };
  const reset = () => {
    try { localStorage.removeItem(HIDDEN_KEY); } catch { /* ignore */ }
    setHidden(new Set(HIDDEN_DEFAULTS));
  };
  const changed = [...hidden].sort().join() !== [...HIDDEN_DEFAULTS].sort().join();
  return { hidden, toggle, reset, changed };
}

function CustomiseDialog({
  open, onOpenChange, hidden, onToggle, onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customise dashboard</DialogTitle>
          <DialogDescription>
            The shift panel, Needs you and the running order always show. Choose the rest — saved on this device.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
          {RAIL_CARDS.map((card) => (
            <li key={card.id}>
              <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/40">
                {card.label}
                <Switch checked={!hidden.has(card.id)} onCheckedChange={() => onToggle(card.id)} />
              </label>
            </li>
          ))}
        </ul>
        <button
          onClick={onReset}
          className="mt-2 inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to the default cards
        </button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One card's place in the grid. `i` is its turn in the arrival (the cards
 * settle in reading order as the page opens); `order` is its place on a phone.
 */
function Cell({ i, order, children }: { i: number; order: string; children: ReactNode }) {
  return (
    <div className={`bento-item flex min-w-0 flex-col gap-4 ${order}`} style={{ "--i": i } as CSSProperties}>
      {children}
    </div>
  );
}

function WatchCommanderDashboard() {
  const { hidden, toggle, reset, changed } = useHiddenCards();
  const [customising, setCustomising] = useState(false);
  const show = (id: string) => !hidden.has(id);

  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>
      <ShiftHero />
      {show("pulse") && <PulseTiles />}

      {/* Three columns on a desktop, two on a small laptop, one on a phone.
          Below lg the columns dissolve (display: contents) and each card
          takes its phone position from its order. */}
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-5 xl:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-4 max-lg:contents lg:gap-5">
          <Cell i={4} order="max-lg:order-1">
            <WCAlertBanner />
            {/* Unread bulletins / unacknowledged policies — only when there's something to chase. */}
            <BulletinsTile />
            <PolicyAcksTile />
          </Cell>
          {show("crew") && <Cell i={7} order="max-lg:order-4"><CrewOnWatchTable compact /></Cell>}
          {show("reference") && <Cell i={9} order="max-lg:order-6"><OurReference /></Cell>}
        </div>

        <div className="flex min-w-0 flex-col gap-4 max-lg:contents lg:gap-5">
          <Cell i={5} order="max-lg:order-2"><ShiftRunningOrder /></Cell>
          {show("comingup") && <Cell i={8} order="max-lg:order-5"><ComingUp /></Cell>}
        </div>

        <aside
          aria-label="Targets, contacts and your balances"
          className="grid min-w-0 items-start gap-4 max-lg:contents lg:col-span-2 lg:grid-cols-3 lg:gap-5 xl:col-span-1 xl:flex xl:flex-col"
        >
          {show("targets") && <Cell i={6} order="max-lg:order-3"><TargetRings /></Cell>}
          {show("contacts") && <Cell i={10} order="max-lg:order-7"><QuickDial /></Cell>}
          {show("h4h") && <Cell i={11} order="max-lg:order-8"><WCH4HWidget /></Cell>}
          {show("toil") && <Cell i={12} order="max-lg:order-9"><ToilWidget /></Cell>}
          {show("skills") && <Cell i={13} order="max-lg:order-10"><WCSkillsExpiryWidget /></Cell>}
        </aside>
      </div>

      <div className="flex items-center justify-center gap-4 pb-2">
        <button
          onClick={() => setCustomising(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Customise dashboard
        </button>
        {changed && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Show the default cards again"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      <CustomiseDialog open={customising} onOpenChange={setCustomising} hidden={hidden} onToggle={toggle} onReset={reset} />
    </div>
  );
}

