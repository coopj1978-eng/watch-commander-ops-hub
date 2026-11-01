import { useState } from "react";

import { useUserRole } from "@/lib/rbac";
import { useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ClipboardCheck, FileText, RotateCcw, SlidersHorizontal } from "lucide-react";
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
import { CrewOnWatchTable }       from "@/components/CrewOnWatchTable";
import { WCContactsWidget }       from "@/components/WCContactsWidget";
import { WCSkillsExpiryWidget }   from "@/components/WCSkillsExpiryWidget";

// CC widgets
import { CCDashboard } from "@/components/CCDashboardWidgets";

// FF widgets
import PersonalDashboard from "@/components/PersonalDashboard";
import { FFCertificationsWidget } from "@/components/FFCertificationsWidget";
import FFSickReportWidget from "@/components/FFSickReportWidget";
import FFShiftAdjustmentWidget from "@/components/FFShiftAdjustmentWidget";
import ToilWidget from "@/components/ToilWidget";
import FFH4HBalanceWidget from "@/components/FFH4HBalanceWidget";

// WC H4H widget — reuses the same balance widget since it's user-aware
const WCH4HWidget = FFH4HBalanceWidget;

// ── Role router ───────────────────────────────────────────────────────────────

export default function RoleDashboard() {
  const role = useUserRole();

  if (role === "WC") return <WatchCommanderDashboard />;
  if (role === "CC") return <CCDashboard />;
  if (role === "FF") return <FirefighterDashboard />;
  return <ReadOnlyDashboard />;
}

// ── Watch Commander home (Nov 2026 rebuild) ────────────────────────────────────
//
// One screen, in the order a WC reads it at the start of a shift:
//   1. the shift now (ShiftHero: clock, countdown, who's riding);
//   2. Needs you — every alert in one ranked list (the only place alerts live);
//   3. the shift's running order, then the week ahead;
//   4. a side rail: targets as rings, the crew (who's off first), contacts
//      and your own balances. The weather is in the shift panel.
// Before this, ~17 cards repeated each other: absence triggers showed three
// times, sickness three times, the handover and HFSV twice each, and the
// 14-day inspections, staffing and KPI tiles duplicated the panels above.
// Cards in the rail and the week ahead can be switched off (per device).

const RAIL_CARDS: { id: string; label: string }[] = [
  { id: "comingup", label: "Coming up — next 7 days" },
  { id: "targets",  label: "Targets" },
  { id: "reference", label: "Our reference" },
  { id: "crew",     label: "Crew" },
  { id: "contacts", label: "Duty contacts" },
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

function WatchCommanderDashboard() {
  const { hidden, toggle, reset, changed } = useHiddenCards();
  const [customising, setCustomising] = useState(false);
  const show = (id: string) => !hidden.has(id);

  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>
      <ShiftHero />
      <WCAlertBanner />

      {/* Unread bulletins / unacknowledged policies — only when there's something to chase. */}
      <BulletinsTile />
      <PolicyAcksTile />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ShiftRunningOrder />
          {show("comingup") && <ComingUp />}
        </div>
        <aside aria-label="At a glance" className="flex min-w-0 flex-col gap-4">
          {show("targets") && <TargetRings />}
          {show("reference") && <OurReference />}
          {show("crew") && <CrewOnWatchTable compact />}
          {show("contacts") && <WCContactsWidget />}
          {show("h4h") && <WCH4HWidget />}
          {show("toil") && <ToilWidget />}
          {show("skills") && <WCSkillsExpiryWidget />}
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

// ── Firefighter dashboard ─────────────────────────────────────────────────────

function FirefighterDashboard() {
  const { user } = useAuth();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {user?.name?.split(" ")[0] || "Firefighter"}
        </h1>
        <p className="text-muted-foreground mt-1">Your personal overview</p>
      </div>

      <PersonalDashboard />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <FFCertificationsWidget />
        <FFSickReportWidget />
        <FFShiftAdjustmentWidget />
        <ToilWidget />
        <FFH4HBalanceWidget />
      </div>
    </div>
  );
}

// ── Read-only dashboard ───────────────────────────────────────────────────────

function ReadOnlyDashboard() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Overview Dashboard</h1>
        <p className="text-muted-foreground mt-1">Read-only access</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-t-2 border-t-brand">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
            <Users className="h-5 w-5 text-brand" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">—</div>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-brand">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Tasks</CardTitle>
            <ClipboardCheck className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">—</div>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-brand">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reports Available</CardTitle>
            <FileText className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">—</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
