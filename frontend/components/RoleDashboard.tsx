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
import { Users, ClipboardCheck, FileText, GripVertical, RotateCcw } from "lucide-react";

// WC widgets
import { WCStaffingWidget }      from "@/components/WCStaffingWidget";
import { WCInspectionsWidget }    from "@/components/WCInspectionsWidget";
import { WCSicknessAlertsWidget } from "@/components/WCSicknessAlertsWidget";
import { WCShiftWidget }          from "@/components/WCShiftWidget";
import { WCSkillsExpiryWidget }   from "@/components/WCSkillsExpiryWidget";
import { WCWeatherWidget }        from "@/components/WCWeatherWidget";
import { WCContactsWidget }       from "@/components/WCContactsWidget";
import { WCHandoverWidget }       from "@/components/WCHandoverWidget";
import { WCAlertBanner }          from "@/components/WCAlertBanner";
import { WCPersonalCalendarWidget } from "@/components/WCPersonalCalendarWidget";
import { OperationalStatusBar }   from "@/components/OperationalStatusBar";
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
  shift:       ["shift", "calendar", "weather", "contacts", "handover", "h4h", "toil"],
  certs:       ["skills"],
  targets:     [],
};

/** Maps widget id → component. */
const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  staffing:    WCStaffingWidget,
  inspections: WCInspectionsWidget,
  sickness:    WCSicknessAlertsWidget,
  weather:     WCWeatherWidget,
  shift:       WCShiftWidget,
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

  const reset = () => {
    localStorage.removeItem("wc-dashboard-layout");
    setLayout({ ...SECTION_DEFAULTS });
  };

  return { layout, isCustomised, reorder, reset };
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
  items,
  onReorder,
  className,
}: {
  sectionKey: SectionKey;
  items: string[];
  onReorder: (section: SectionKey, newOrder: string[]) => void;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      onReorder(sectionKey, arrayMove(items, oldIndex, newIndex));
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
  const { layout, isCustomised, reorder, reset } = useDashboardLayout();

  // Top-level section gap responds to the user's density preference via the
  // --gap-section CSS variable. Defaults to 32px (space-y-8 equivalent) but
  // compresses to 20px or stretches to 40px based on the Appearance setting.
  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>

      {/* ── Reset-layout affordance — only surfaces when the WC has
              re-ordered widgets from defaults. Replaces the old command
              strip (watch/date/shift now live in the TopBar and the
              OperationalStatusBar below). ─────────────────────────────── */}
      {isCustomised && (
        <div className="flex justify-end -mb-2 animate-in fade-in-0 duration-300">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Restore default widget positions"
          >
            <RotateCcw className="h-3 w-3" />
            Reset widget layout
          </button>
        </div>
      )}

      {/* ── Alert banner ───────────────────────────────────────────────── */}
      <WCAlertBanner />

      {/* ── Last handover summary ─ one-line strip surfacing what the
              previous shift left for this WC. Shares the
              ["wc-latest-handover"] query cache with WCHandoverWidget so
              there's no extra network traffic. Renders nothing when no
              handover exists — the widget lower in the grid handles the
              first-handover CTA. ─────────────────────────────────────── */}
      <LatestHandoverBanner />

      {/* ── Unread bulletins summary ─ only renders when there's something
              to chase. Links through to /bulletins. Urgent red variant
              kicks in when a requires_ack bulletin is still outstanding. */}
      <BulletinsTile />

      {/* ── Unacknowledged required policies — red strip when the caller
              has SOPs still awaiting their acknowledgement. Renders nothing
              when caught up. Shares the ["policies"] cache with the Docs
              page so there's no extra network traffic. */}
      <PolicyAcksTile />

      {/* ── At-a-glance status bar (5 cells: date, watch, shift, strength,
              tasks). Reuses the same TanStack queryKeys as the downstream
              widgets so it adds no extra network traffic. ────────────── */}
      <OperationalStatusBar />

      {/* ── 4-KPI row — Tasks / HFSV / Absence / Alerts. Shares query
              caches with the dashboard widgets below, so adds no network
              traffic. Clickable tiles navigate to the relevant page. ── */}
      <DashboardKPIs />

      {/* ── Operational Status ─────────────────────────────────────────── */}
      <section className={SECTION_ANIM}>
        <SectionLabel>Operational Status</SectionLabel>
        <SortableGrid
          sectionKey="operational"
          items={layout.operational}
          onReorder={reorder}
          className={GRID_CLASS}
        />
      </section>

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
      <section className={`${SECTION_ANIM} delay-75`}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)]">
          <div className="space-y-6 min-w-0">
            {/* Crew on Watch — the main operational table. Card title +
                meta live inside <CrewOnWatchTable> itself, so no outer
                SectionLabel needed here (the card speaks for itself). */}
            <CrewOnWatchTable />

            {/* Scheduled today & tomorrow — unified events table. Card
                owns its "Scheduled today & tomorrow" header. */}
            <ScheduledTodayTomorrow />
          </div>

          {/* Right column — reference cards. Their own CardTitles handle
              the visible heading, so no SectionLabel needed. */}
          <aside className="space-y-6 min-w-0">
            <TargetsCompact />
            <AbsenceTriggersCard />
          </aside>
        </div>
      </section>

      {/* ── Today's Shift ──────────────────────────────────────────────── */}
      <section className={`${SECTION_ANIM} delay-100`}>
        <SectionLabel>Today's Shift</SectionLabel>
        <SortableGrid
          sectionKey="shift"
          items={layout.shift}
          onReorder={reorder}
          className={GRID_CLASS}
        />
      </section>

      {/* ── Certifications & Training ──────────────────────────────────── */}
      <section className={`${SECTION_ANIM} delay-150`}>
        <SectionLabel>Qualifications &amp; Training</SectionLabel>
        <SortableGrid
          sectionKey="certs"
          items={layout.certs}
          onReorder={reorder}
          className={GRID_CLASS}
        />
      </section>

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
