import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2, Flame, Home, Wrench, RefreshCw, ChevronDown, ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useIsWC } from "@/lib/rbac";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import type { inspection_plans } from "@/client";

type WatchName = "Red" | "White" | "Green" | "Blue" | "Amber";
type PlanType = "multistory" | "care_home" | "hydrant" | "operational";

const ALL_WATCHES: WatchName[] = ["Red", "White", "Green", "Blue", "Amber"];

const WATCH_COLORS: Record<WatchName, string> = {
  Red:   "bg-red-500/10 text-red-600 border-red-400/30",
  White: "bg-gray-100 text-gray-700 border-gray-300",
  Green: "bg-green-500/10 text-green-600 border-green-400/30",
  Blue:  "bg-blue-500/10 text-blue-600 border-blue-400/30",
  Amber: "bg-amber-500/10 text-amber-600 border-amber-400/30",
};

const SECTION_CONFIG: Array<{
  type: PlanType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  isQuarterly: boolean;
}> = [
  { type: "multistory",  label: "Multi-Story Inspections", icon: Building2, description: "Premises requiring quarterly inspection",    isQuarterly: true },
  { type: "care_home",   label: "Care Home Validations",   icon: Home,      description: "Annual validation visits by all watches",   isQuarterly: false },
  { type: "hydrant",     label: "Hydrant Register",        icon: Flame,     description: "Annual hydrant inspections by watch",       isQuarterly: false },
  { type: "operational", label: "Operational Inspections", icon: Wrench,    description: "Annual operational inspection programme",   isQuarterly: false },
];

function WatchBadge({ watch }: { watch: WatchName }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${WATCH_COLORS[watch]}`}>
      {watch}
    </span>
  );
}

function SectionCard({
  config,
  items,
  canComplete,
  onToggle,
  isToggling,
  showQuarterCol,
}: {
  config: typeof SECTION_CONFIG[number];
  items: inspection_plans.InspectionAssignment[];
  canComplete: boolean;
  onToggle: (id: number, current: "pending" | "complete") => void;
  isToggling: number | null;
  showQuarterCol: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const Icon = config.icon;
  const total    = items.length;
  const complete = items.filter(i => i.status === "complete").length;
  const pct      = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Icon className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-base">{config.label}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{config.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold">{complete} / {total}</div>
              <div className="text-xs text-muted-foreground">complete</div>
            </div>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        {total > 0 && (
          <div className="mt-3 space-y-1">
            <Progress value={pct} className="h-1.5" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{pct}% complete</span>
              <span>{total - complete} remaining</span>
            </div>
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assignments for this type — click Generate to create them.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    {canComplete && <th className="pb-2 w-8" />}
                    <th className="pb-2 text-left font-medium">Location</th>
                    <th className="pb-2 text-center font-medium px-3">Watch</th>
                    {config.isQuarterly && showQuarterCol && (
                      <th className="pb-2 text-center font-medium px-3">Quarter</th>
                    )}
                    <th className="pb-2 text-center font-medium px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr
                      key={item.id}
                      className={`border-b border-border last:border-0 transition-colors ${
                        item.status === "complete" ? "opacity-60" : "hover:bg-muted/30"
                      }`}
                    >
                      {canComplete && (
                        <td className="py-2 pr-2">
                          <Checkbox
                            checked={item.status === "complete"}
                            disabled={isToggling === item.id}
                            onCheckedChange={() => onToggle(item.id, item.status)}
                            className="cursor-pointer"
                          />
                        </td>
                      )}
                      <td className={`py-2 ${item.status === "complete" ? "line-through text-muted-foreground" : ""}`}>
                        {item.label}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <WatchBadge watch={item.watch} />
                      </td>
                      {config.isQuarterly && showQuarterCol && (
                        <td className="py-2 px-3 text-center text-xs text-muted-foreground">
                          {item.quarter ? `Q${item.quarter}` : "—"}
                        </td>
                      )}
                      <td className="py-2 px-3 text-center">
                        {item.status === "complete" ? (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-400/30">
                            Complete
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-400/30">
                            Pending
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface Props {
  year: number;
  quarter: number | null; // null = all quarters (yearly view)
}

export default function InspectionAssignments({ year, quarter }: Props) {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const isWC      = useIsWC();
  const { user }  = useAuth();
  const canManage = isWC || user?.role === "CC";

  // The user's own watch from their profile (e.g. "Red", "Blue", etc.)
  const userWatch = user?.watch_unit ?? null;

  // Managers (WC/CC) can switch between watches to review any watch's workload.
  // Everyone else is locked to their own watch.
  const [watchFilter, setWatchFilter] = useState<string>(userWatch ?? "all");
  const [togglingId, setTogglingId]   = useState<number | null>(null);

  // Non-managers always see their own watch regardless of the dropdown state.
  const effectiveWatch = canManage ? watchFilter : (userWatch ?? "all");

  // Quarter label for display (e.g. "Q1 2026" or "2026")
  const periodLabel = quarter ? `Q${quarter} ${year}` : `${year}`;

  // Watch label for display
  const watchLabel = effectiveWatch === "all" ? "All Watches" : `${effectiveWatch} Watch`;

  // Fetch all assignments for the year & effective watch.
  // Quarter filtering for multi-story is done client-side so annual sections
  // (care homes, hydrants, OIs) always show regardless of the selected quarter.
  const queryKey = ["inspection-assignments", year, effectiveWatch];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => backend.inspection_plans.listAssignments({
      year,
      watch: effectiveWatch !== "all" ? effectiveWatch : undefined,
    }),
  });

  const generateMutation = useMutation({
    mutationFn: () => backend.inspection_plans.generateAssignments({ year }),
    onSuccess: (res) => {
      toast({
        title: "Assignments generated",
        description: `${res.created} created, ${res.skipped} already existed.`,
      });
      qc.invalidateQueries({ queryKey: ["inspection-assignments"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to generate assignments", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "pending" | "complete" }) =>
      backend.inspection_plans.updateAssignment(id, {
        status: status === "complete" ? "pending" : "complete",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection-assignments"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update assignment", variant: "destructive" }),
    onSettled: () => setTogglingId(null),
  });

  const handleToggle = (id: number, current: "pending" | "complete") => {
    setTogglingId(id);
    toggleMutation.mutate({ id, status: current });
  };

  const allItems = data?.items ?? [];

  // Multi-story: filter to the active quarter if one is selected.
  // Annual sections: always show items with quarter = null.
  const getItemsForSection = (type: PlanType) => {
    if (type === "multistory") {
      return allItems.filter(i =>
        i.plan_type === "multistory" &&
        (quarter === null || i.quarter === quarter)
      );
    }
    return allItems.filter(i => i.plan_type === type);
  };

  // Overall totals are based on what's currently visible
  const visibleItems = SECTION_CONFIG.flatMap(cfg => getItemsForSection(cfg.type));
  const totalComplete = visibleItems.filter(i => i.status === "complete").length;
  const totalAll      = visibleItems.length;
  const overallPct    = totalAll > 0 ? Math.round((totalComplete / totalAll) * 100) : 0;

  // When viewing a specific quarter, hide the Quarter column from multi-story
  // (they're all the same quarter so it's redundant).
  const showQuarterCol = quarter === null;

  const hasAnyAssignments = allItems.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Inspection Workload</h2>
          <p className="text-sm text-muted-foreground">
            {quarter
              ? `${watchLabel} — ${periodLabel} multi-story assignments plus annual items`
              : `${watchLabel} — all inspections for ${year}`}
          </p>
        </div>

        {/* Watch filter (managers only) + Generate */}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Select value={watchFilter} onValueChange={setWatchFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select watch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All watches</SelectItem>
                {ALL_WATCHES.map(w => (
                  <SelectItem key={w} value={w}>{w} Watch</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={generateMutation.isPending}
              onClick={() => {
                if (confirm(`Generate inspection assignments for ${year}? Existing assignments will not be duplicated.`)) {
                  generateMutation.mutate();
                }
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              Generate {year}
            </Button>
          )}
        </div>
      </div>

      {/* Overall summary */}
      {hasAnyAssignments && totalAll > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Overall progress — {watchLabel}, {periodLabel}</span>
                  <span className="text-muted-foreground">{totalComplete} / {totalAll} complete</span>
                </div>
                <Progress value={overallPct} className="h-2" />
              </div>
              <div className="text-2xl font-bold text-right">{overallPct}%</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading assignments…
        </div>
      )}

      {/* No data yet */}
      {!isLoading && !hasAnyAssignments && (
        <Card>
          <CardContent className="text-center py-10">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No assignments for {year}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {canManage
                ? `Click "Generate ${year}" to create assignments from the Inspection Plans.`
                : "No inspection assignments have been generated for this period yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Section cards */}
      {!isLoading && hasAnyAssignments && SECTION_CONFIG.map(config => {
        const sectionItems = getItemsForSection(config.type);
        // Hide sections with no items when a specific watch is active
        if (sectionItems.length === 0 && effectiveWatch !== "all") return null;
        return (
          <SectionCard
            key={config.type}
            config={config}
            items={sectionItems}
            canComplete={canManage}
            onToggle={handleToggle}
            isToggling={togglingId}
            showQuarterCol={showQuarterCol}
          />
        );
      })}
    </div>
  );
}
