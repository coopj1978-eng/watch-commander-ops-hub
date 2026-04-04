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
import { Users, ClipboardCheck, FileText, Shield, Clock, GripVertical, RotateCcw } from "lucide-react";

// WC widgets
import { WCStaffingWidget }      from "@/components/WCStaffingWidget";
import { WCTasksWidget }          from "@/components/WCTasksWidget";
import { WCInspectionsWidget }    from "@/components/WCInspectionsWidget";
import { WCSicknessAlertsWidget } from "@/components/WCSicknessAlertsWidget";
import { WCShiftWidget }          from "@/components/WCShiftWidget";
import { WCSkillsExpiryWidget }   from "@/components/WCSkillsExpiryWidget";
import { WCHFSVWidget }           from "@/components/WCHFSVWidget";
import { WCCommunityWidget }      from "@/components/WCCommunityWidget";
import { WCMultiStoryWidget }     from "@/components/WCMultiStoryWidget";
import { WCWeatherWidget }        from "@/components/WCWeatherWidget";
import { WCContactsWidget }       from "@/components/WCContactsWidget";
import { WCHandoverWidget }       from "@/components/WCHandoverWidget";
import { WCAlertBanner }          from "@/components/WCAlertBanner";
import { WCPersonalCalendarWidget } from "@/components/WCPersonalCalendarWidget";

// CC widgets
import { CCDashboard } from "@/components/CCDashboardWidgets";

// FF widgets
import PersonalDashboard from "@/components/PersonalDashboard";
import { FFCertificationsWidget } from "@/components/FFCertificationsWidget";
import FFSickReportWidget from "@/components/FFSickReportWidget";
import FFShiftAdjustmentWidget from "@/components/FFShiftAdjustmentWidget";
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

const SECTION_DEFAULTS: Record<SectionKey, string[]> = {
  operational: ["staffing", "sickness", "tasks", "inspections"],
  shift:       ["shift", "calendar", "weather", "contacts", "handover", "h4h"],
  certs:       ["skills"],
  targets:     ["hfsv", "community", "multistory"],
};

/** Maps widget id → component. */
const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  staffing:    WCStaffingWidget,
  tasks:       WCTasksWidget,
  inspections: WCInspectionsWidget,
  multistory:  WCMultiStoryWidget,
  sickness:    WCSicknessAlertsWidget,
  weather:     WCWeatherWidget,
  shift:       WCShiftWidget,
  contacts:    WCContactsWidget,
  handover:    WCHandoverWidget,
  skills:      WCSkillsExpiryWidget,
  hfsv:        WCHFSVWidget,
  community:   WCCommunityWidget,
  h4h:         WCH4HWidget,
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

// ── Command strip ─────────────────────────────────────────────────────────────

function getShiftLabel(): string {
  const h = new Date().getHours();
  return h >= 8 && h < 18 ? "Day Shift" : "Night Shift";
}

function WCCommandStrip({ isCustomised, onReset }: { isCustomised: boolean; onReset: () => void }) {
  const { user } = useAuth();
  const watch = user?.watch_unit;

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });
  const shift = getShiftLabel();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/60 text-sm">
      {/* Watch badge */}
      {watch ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
          <Shield className="h-3.5 w-3.5" />
          {watch} Watch
        </span>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">No watch assigned</Badge>
      )}

      <span className="h-4 w-px bg-border hidden sm:block" />

      {/* Date */}
      <span className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{dateStr}</span>
      </span>

      <span className="h-4 w-px bg-border hidden sm:block" />

      {/* Shift */}
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-foreground">{shift}</span>
      </span>

      {/* Reset layout — only shown when layout has been customised */}
      {isCustomised && (
        <>
          <span className="flex-1" />
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Restore default widget positions"
          >
            <RotateCcw className="h-3 w-3" />
            Reset layout
          </button>
        </>
      )}
    </div>
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

  return (
    <div className="space-y-8">

      {/* ── Command strip ──────────────────────────────────────────────── */}
      <div className="animate-in fade-in-0 slide-in-from-top-2 duration-400">
        <WCCommandStrip isCustomised={isCustomised} onReset={reset} />
      </div>

      {/* ── Alert banner ───────────────────────────────────────────────── */}
      <WCAlertBanner />

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

      {/* ── Performance Targets ────────────────────────────────────────── */}
      <section className={`${SECTION_ANIM} delay-200`}>
        <SectionLabel>Performance Targets</SectionLabel>
        <SortableGrid
          sectionKey="targets"
          items={layout.targets}
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
        <Card className="border-t-2 border-t-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
            <Users className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">—</div>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Tasks</CardTitle>
            <ClipboardCheck className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">—</div>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-indigo-500">
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
