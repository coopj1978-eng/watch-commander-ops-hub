import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useUserRole } from "@/lib/rbac";
import { useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ClipboardCheck, FileText, GripVertical, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

// WC widgets
import { WCStaffingWidget }      from "@/components/WCStaffingWidget";
import { WCInspectionsWidget }    from "@/components/WCInspectionsWidget";
import { WCSicknessAlertsWidget } from "@/components/WCSicknessAlertsWidget";
import { WCSkillsExpiryWidget }   from "@/components/WCSkillsExpiryWidget";
import { WCWeatherWidget }        from "@/components/WCWeatherWidget";
import { WCContactsWidget }       from "@/components/WCContactsWidget";
import { WCHandoverWidget }       from "@/components/WCHandoverWidget";
import { WCAlertBanner }          from "@/components/WCAlertBanner";
import { WCPersonalCalendarWidget } from "@/components/WCPersonalCalendarWidget";
import { ShiftHero }              from "@/components/ShiftHero";
import { ThisShiftCard }          from "@/components/ThisShiftCard";
import { LatestHandoverBanner }   from "@/components/LatestHandoverBanner";
import { BulletinsTile }          from "@/components/BulletinsTile";
import { PolicyAcksTile }         from "@/components/PolicyAcksTile";
import { ScheduledTodayTomorrow } from "@/components/ScheduledTodayTomorrow";
import { AbsenceTriggersCard }   from "@/components/AbsenceTriggersCard";
import { DashboardKPIs }          from "@/components/DashboardKPIs";
import { CrewOnWatchTable }       from "@/components/CrewOnWatchTable";
import { TargetsCompact }         from "@/components/TargetsCompact";

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

// ── Drag-and-drop layout ──────────────────────────────────────────────────────

type SectionKey = "operational" | "shift" | "certs" | "targets";

// Editorial cleanup (2026-04-23): removed `tasks`, `hfsv`, `community`,
// `multistory` from the defaults because they're now covered by the new
// compact dashboard pieces (DashboardKPIs covers Tasks; TargetsCompact
// covers HFSV/Community/Multi-Story with progress bars + pace). Widget
// components left on disk so users who prefer the detailed view can
// re-enable them if/when we add a widget picker.
const SECTION_DEFAULTS: Record<SectionKey, string[]> = {
  operational: ["staffing", "sickness", "inspections"],
  // The crewing card moved into ShiftHero's riding board at the top.
  shift:       ["calendar", "weather", "contacts", "handover", "h4h", "toil"],
  certs:       ["skills"],
  targets:     [],
};

/** Maps widget id → component. */
const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  staffing:    WCStaffingWidget,
  inspections: WCInspectionsWidget,
  sickness:    WCSicknessAlertsWidget,
  weather:     WCWeatherWidget,
  contacts:    WCContactsWidget,
  handover:    WCHandoverWidget,
  skills:      WCSkillsExpiryWidget,
  h4h:         WCH4HWidget,
  toil:        ToilWidget,
  calendar:    WCPersonalCalendarWidget,
};

/** Persists widget order per section to localStorage. */
function useDashboardLayout() {
  const [layout, setLayout] = useState<Record<SectionKey, string[]>>(() => {
    try {
      const saved = localStorage.getItem("wc-dashboard-layout");
      if (saved) {
        const parsed: Partial<Record<SectionKey, string[]>> = JSON.parse(saved);
        // Merge: keep saved order for known IDs, append any newly-added defaults
        return Object.fromEntries(
          (Object.keys(SECTION_DEFAULTS) as SectionKey[]).map(key => {
            const savedIds   = (parsed[key] ?? []).filter(id => SECTION_DEFAULTS[key].includes(id));
            const newDefaults = SECTION_DEFAULTS[key].filter(id => !savedIds.includes(id));
            return [key, [...savedIds, ...newDefaults]];
          }),
        ) as Record<SectionKey, string[]>;
      }
    } catch { /* ignore corrupt localStorage */ }
    return { ...SECTION_DEFAULTS };
  });

  const isCustomised = JSON.stringify(layout) !== JSON.stringify(SECTION_DEFAULTS);

  const reorder = (section: SectionKey, newOrder: string[]) => {
    setLayout(prev => {
      const next = { ...prev, [section]: newOrder };
      localStorage.setItem("wc-dashboard-layout", JSON.stringify(next));
      return next;
    });
  };

  // Cards the WC has switched off. Staffing, the sickness count and the last
  // handover strip start off: the shift panel, the Needs you list and the
  // This shift card already show them.
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("wc-dashboard-hidden");
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore corrupt localStorage */ }
    return new Set(HIDDEN_DEFAULTS);
  });

  const toggleHidden = (id: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("wc-dashboard-hidden", JSON.stringify([...next]));
      return next;
    });
  };

  const reset = () => {
    localStorage.removeItem("wc-dashboard-layout");
    localStorage.removeItem("wc-dashboard-hidden");
    setLayout({ ...SECTION_DEFAULTS });
    setHidden(new Set(HIDDEN_DEFAULTS));
  };

  const hiddenChanged =
    [...hidden].sort().join() !== [...HIDDEN_DEFAULTS].sort().join();

  return { layout, isCustomised: isCustomised || hiddenChanged, reorder, reset, hidden, toggleHidden };
}

const HIDDEN_DEFAULTS = ["staffing", "sickness", "lasthandover"];

/** Every card the WC can switch on or off, grouped as they appear. */
const CARD_GROUPS: { label: string; cards: { id: string; label: string }[] }[] = [
  { label: "Overview", cards: [
    { id: "thisshift", label: "This shift — board & handover" },
    { id: "lasthandover", label: "Last handover strip" },
    { id: "kpis", label: "Tasks / HFSV / absence / alerts tiles" },
  ] },
  { label: "Operational status", cards: [
    { id: "staffing", label: "Staffing today" },
    { id: "sickness", label: "Absence triggers count" },
    { id: "inspections", label: "Inspections" },
  ] },
  { label: "Crew & plans", cards: [
    { id: "crew", label: "Crew on watch" },
    { id: "scheduled", label: "Scheduled today & tomorrow" },
    { id: "targets", label: "Performance targets" },
    { id: "triggers", label: "Absence triggers list" },
  ] },
  { label: "Today's shift", cards: [
    { id: "calendar", label: "Calendar" },
    { id: "weather", label: "Weather" },
    { id: "contacts", label: "Duty contacts" },
    { id: "handover", label: "Last handover" },
    { id: "h4h", label: "H4H balance" },
    { id: "toil", label: "TOIL" },
  ] },
  { label: "Qualifications & training", cards: [
    { id: "skills", label: "Skills & renewals" },
  ] },
];

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
            Choose which cards show. Drag a card by its corner handle to move it. Saved on this device.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {CARD_GROUPS.map(group => (
            <div key={group.label}>
              <div className="eyebrow mb-1.5">{group.label}</div>
              <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                {group.cards.map(card => (
                  <li key={card.id}>
                    <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/40">
                      {card.label}
                      <Switch checked={!hidden.has(card.id)} onCheckedChange={() => onToggle(card.id)} />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <button
          onClick={onReset}
          className="mt-2 inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to the default layout
        </button>
      </DialogContent>
    </Dialog>
  );
}

// ── SortableWidget wrapper ───────────────────────────────────────────────────

function SortableWidget({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity:  isDragging ? 0.35 : 1,
        zIndex:   isDragging ? 20 : undefined,
        position: "relative",
      }}
      className={`group relative ${!isDragging ? "hover:-translate-y-0.5 hover:shadow-md" : ""} transition-all duration-200`}
    >
      {/* Drag handle — floats off the top-left corner on hover */}
      <div
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder widget"
        title="Drag to reorder"
        className="absolute -top-2.5 -left-2.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity
                   cursor-grab active:cursor-grabbing
                   p-1 rounded-md bg-background border border-border/70 shadow-sm"
        style={{ touchAction: "none" }}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {children}
    </div>
  );
}

// ── SortableGrid ──────────────────────────────────────────────────────────────

function SortableGrid({
  sectionKey,
  items: allItems,
  hidden,
  onReorder,
  className,
}: {
  sectionKey: SectionKey;
  items: string[];
  hidden: Set<string>;
  onReorder: (section: SectionKey, newOrder: string[]) => void;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const items = allItems.filter(id => !hidden.has(id));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      const oldIndex = allItems.indexOf(active.id as string);
      const newIndex = allItems.indexOf(over.id as string);
      onReorder(sectionKey, arrayMove(allItems, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={rectSortingStrategy}>
        <div className={className}>
          {items.map(id => {
            const Widget = WIDGET_COMPONENTS[id];
            return Widget ? (
              <SortableWidget key={id} id={id}>
                <Widget />
              </SortableWidget>
            ) : null;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        {children}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Watch Commander dashboard ─────────────────────────────────────────────────

const GRID_CLASS    = "grid gap-4 md:grid-cols-2 lg:grid-cols-3";
const SECTION_ANIM  = "space-y-3 animate-in fade-in-0 slide-in-from-bottom-3 duration-500";

function WatchCommanderDashboard() {
  const { layout, isCustomised, reorder, reset, hidden, toggleHidden } = useDashboardLayout();
  const [customising, setCustomising] = useState(false);
  const show = (id: string) => !hidden.has(id);
  const anyShown = (ids: string[]) => ids.some(show);

  // Top-level section gap responds to the user's density preference via the
  // --gap-section CSS variable. Defaults to 32px (space-y-8 equivalent) but
  // compresses to 20px or stretches to 40px based on the Appearance setting.
  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>

      {/* ── Shift now ─ watch, live shift timeline, who's riding and the
              next places to go. Replaces the old five-cell status bar and
              the crewing card. ─────────────────────────────────────────── */}
      <ShiftHero />

      {/* ── Alert banner ───────────────────────────────────────────────── */}
      <WCAlertBanner />

      {/* ── This shift ─ the shift board's open cards and the unread
              handover for this watch. ──────────────────────────────────── */}
      {show("thisshift") && <ThisShiftCard />}

      {/* ── Last handover summary ─ one-line strip (off by default — the
              card above covers the handover). ──────────────────────────── */}
      {show("lasthandover") && <LatestHandoverBanner />}

      {/* ── Unread bulletins / unacknowledged policies — only render when
              there's something to chase. ───────────────────────────────── */}
      <BulletinsTile />
      <PolicyAcksTile />

      {/* ── 4-KPI row — Tasks / HFSV / Absence / Alerts. Shares query
              caches with the dashboard widgets below, so adds no network
              traffic. Clickable tiles navigate to the relevant page. ── */}
      {show("kpis") && <DashboardKPIs />}

      {/* ── Operational Status ─────────────────────────────────────────── */}
      {anyShown(layout.operational) && (
      <section className={SECTION_ANIM}>
        <SectionLabel>Operational Status</SectionLabel>
        <SortableGrid
          sectionKey="operational"
          items={layout.operational}
          hidden={hidden}
          onReorder={reorder}
          className={GRID_CLASS}
        />
      </section>
      )}

      {/* ── Two-column "command-room" section ──────────────────────────────
              Mirrors the original design mockup: a wide left column for
              the operational tables (Crew on Watch + Scheduled today &
              tomorrow), a narrower right column for the reference cards
              (Performance Targets + Absence Triggers).
              Breakpoint is `xl` (1280px) rather than `lg` because the
              right-column Performance Summary needs ~400px to fit its
              label / bar / numbers / pace-pill row without clipping. At
              1024-1279px the sidebar + two-column split would squeeze
              both sides below the usable minimum. Single column below
              that — the exact layout we had before restructuring. */}
      {anyShown(["crew", "scheduled", "targets", "triggers"]) && (
      <section className={`${SECTION_ANIM} delay-75`}>
        <div className={`grid gap-6 ${anyShown(["crew", "scheduled"]) && anyShown(["targets", "triggers"]) ? "xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)]" : ""}`}>
          {anyShown(["crew", "scheduled"]) && (
          <div className="space-y-6 min-w-0">
            {/* Crew on Watch — the main operational table. Card title +
                meta live inside <CrewOnWatchTable> itself, so no outer
                SectionLabel needed here (the card speaks for itself). */}
            {show("crew") && <CrewOnWatchTable />}

            {/* Scheduled today & tomorrow — unified events table. Card
                owns its "Scheduled today & tomorrow" header. */}
            {show("scheduled") && <ScheduledTodayTomorrow />}
          </div>
          )}

          {/* Right column — reference cards. Their own CardTitles handle
              the visible heading, so no SectionLabel needed. */}
          {anyShown(["targets", "triggers"]) && (
          <aside className="space-y-6 min-w-0">
            {show("targets") && <TargetsCompact />}
            {show("triggers") && <AbsenceTriggersCard />}
          </aside>
          )}
        </div>
      </section>
      )}

      {/* ── Today's Shift ──────────────────────────────────────────────── */}
      {anyShown(layout.shift) && (
      <section className={`${SECTION_ANIM} delay-100`}>
        <SectionLabel>Today's Shift</SectionLabel>
        <SortableGrid
          sectionKey="shift"
          items={layout.shift}
          hidden={hidden}
          onReorder={reorder}
          className={GRID_CLASS}
        />
      </section>
      )}

      {/* ── Certifications & Training ──────────────────────────────────── */}
      {anyShown(layout.certs) && (
      <section className={`${SECTION_ANIM} delay-150`}>
        <SectionLabel>Qualifications &amp; Training</SectionLabel>
        <SortableGrid
          sectionKey="certs"
          items={layout.certs}
          hidden={hidden}
          onReorder={reorder}
          className={GRID_CLASS}
        />
      </section>
      )}

      {/* ── Customise — switch cards on/off, reset order ─────────────────── */}
      <div className="flex items-center justify-center gap-4 pb-2">
        <button
          onClick={() => setCustomising(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Customise dashboard
        </button>
        {isCustomised && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Restore the default cards and positions"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      <CustomiseDialog
        open={customising}
        onOpenChange={setCustomising}
        hidden={hidden}
        onToggle={toggleHidden}
        onReset={reset}
      />
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
