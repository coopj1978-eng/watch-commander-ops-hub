import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUsers } from "./AdminUsers";
import { useFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";
import { useToast } from "@/components/ui/use-toast";
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  Target,
  Navigation,
  Truck,
  ClipboardList,
  FileText,
  BookOpen,
  BarChart3,
  ClipboardCheck,
  Save,
} from "lucide-react";

const FEATURE_CONFIG: {
  key: keyof FeatureFlags;
  label: string;
  description: string;
  icon: React.ElementType;
  phase: string;
}[] = [
  { key: "dashboard",    label: "Dashboard",      description: "Main dashboard with operational overview",          icon: LayoutDashboard, phase: "Phase 1" },
  { key: "people",       label: "People",         description: "Staff directory and profile management",           icon: Users,           phase: "Phase 1" },
  { key: "calendar",     label: "Calendar",       description: "Watch calendar and event management",              icon: Calendar,        phase: "Phase 1" },
  { key: "detachments",  label: "Detachments",    description: "Detachment rota and planning",                     icon: Navigation,      phase: "Phase 1" },
  { key: "tasks",        label: "Tasks",          description: "Task board and assignment tracking",               icon: CheckSquare,     phase: "Phase 2" },
  { key: "handover",     label: "Shift / Handover", description: "Shift management and handover notes",            icon: ClipboardList,   phase: "Phase 2" },
  { key: "equipment",    label: "J4 Checks",      description: "Equipment checks and defect tracking",             icon: Truck,           phase: "Phase 3" },
  { key: "inspections",  label: "Inspections",    description: "HFSV and multi-storey inspections",                icon: ClipboardCheck,  phase: "Phase 3" },
  { key: "targets",      label: "Targets",        description: "Performance targets and tracking",                 icon: Target,          phase: "Phase 4" },
  { key: "policies",     label: "Policies",       description: "Policy documents and Q&A",                        icon: FileText,        phase: "Phase 4" },
  { key: "resources",    label: "Resources",      description: "Reference guides and resources",                   icon: BookOpen,        phase: "Phase 4" },
  { key: "reports",      label: "Reports",        description: "Quarterly reports and analytics",                  icon: BarChart3,       phase: "Phase 4" },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("features");

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-indigo-500 shrink-0" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground mt-1">System administration, feature management, and audit logs</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="features">Feature Management</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="mt-6">
          <FeatureManagementTab />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <AdminUsers />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ActivityLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeatureManagementTab() {
  const { flags, refetch } = useFeatureFlags();
  const { toast } = useToast();
  const [localFlags, setLocalFlags] = useState<FeatureFlags>(flags);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when flags load
  useState(() => {
    setLocalFlags(flags);
  });

  const handleToggle = (key: keyof FeatureFlags) => {
    setLocalFlags((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      await backend.settings.updateFeatureFlags({ feature_flags: localFlags });
      refetch();
      setHasChanges(false);
      toast({
        title: "Features updated",
        description: "Feature visibility has been saved. Changes take effect immediately for all users.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save feature flags",
      });
    }
  };

  const handleEnablePhase = (phase: string) => {
    setLocalFlags((prev) => {
      const updated = { ...prev };
      FEATURE_CONFIG.forEach((f) => {
        if (f.phase === phase) {
          updated[f.key] = true;
        }
      });
      setHasChanges(true);
      return updated;
    });
  };

  const handleEnableAll = () => {
    const allOn: FeatureFlags = {} as FeatureFlags;
    FEATURE_CONFIG.forEach((f) => { allOn[f.key] = true; });
    setLocalFlags(allOn);
    setHasChanges(true);
  };

  const phases = [...new Set(FEATURE_CONFIG.map((f) => f.phase))];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Feature Visibility</CardTitle>
              <CardDescription className="mt-1">
                Control which sections are visible to CC, FF, and RO users. WC and Admin users always see all sections regardless of these settings.
              </CardDescription>
            </div>
            {hasChanges && (
              <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Phase quick-enable buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {phases.map((phase) => (
              <Button
                key={phase}
                size="sm"
                variant="outline"
                onClick={() => handleEnablePhase(phase)}
                className="text-xs"
              >
                Enable {phase}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={handleEnableAll} className="text-xs">
              Enable All
            </Button>
          </div>

          {/* Feature toggles grouped by phase */}
          <div className="space-y-6">
            {phases.map((phase) => (
              <div key={phase}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  {phase}
                </h3>
                <div className="grid gap-3">
                  {FEATURE_CONFIG.filter((f) => f.phase === phase).map((feature) => {
                    const Icon = feature.icon;
                    const isOn = localFlags[feature.key] ?? true;
                    return (
                      <div
                        key={feature.key}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isOn ? "bg-background border-border" : "bg-muted/50 border-dashed border-muted-foreground/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                            isOn ? "bg-indigo-100 dark:bg-indigo-900/30" : "bg-muted"
                          }`}>
                            <Icon className={`h-5 w-5 ${isOn ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground/50"}`} />
                          </div>
                          <div>
                            <Label htmlFor={`feature-${feature.key}`} className={`font-medium cursor-pointer ${!isOn && "text-muted-foreground"}`}>
                              {feature.label}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={isOn ? "default" : "secondary"} className={`text-xs ${isOn ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}`}>
                            {isOn ? "Visible" : "Hidden"}
                          </Badge>
                          <Switch
                            id={`feature-${feature.key}`}
                            checked={isOn}
                            onCheckedChange={() => handleToggle(feature.key)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityLogTab() {
  const PAGE_SIZE = 50;
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);

  // Reset to first page whenever filters change so we don't end up on an empty page.
  const resetPage = () => setPage(0);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["activity-log", actionFilter, entityFilter, userFilter, startDate, endDate, page],
    queryFn: async () => {
      const result = await backend.admin.getActivityLog({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        user_id: userFilter || undefined,
        // Date range is inclusive of start, exclusive of end (end is bumped to next day).
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate
          ? new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString()
          : undefined,
      });
      return result;
    },
    placeholderData: (prev) => prev,
  });

  const total = data?.total ?? 0;
  const logs = data?.logs ?? [];
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);
  const canGoNext = (page + 1) * PAGE_SIZE < total;
  const hasFilters = actionFilter || entityFilter || userFilter || startDate || endDate;

  const clearFilters = () => {
    setActionFilter("");
    setEntityFilter("");
    setUserFilter("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>
          {total === 0 && !hasFilters
            ? "Recent system activity and audit trail"
            : `${total.toLocaleString()} ${total === 1 ? "event" : "events"}${
                hasFilters ? (total === 1 ? " matches your filters" : " match your filters") : ""
              }`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter row */}
        <div className="grid gap-3 md:grid-cols-5 mb-4">
          <div>
            <Label htmlFor="filter-action" className="text-xs">Action</Label>
            <input
              id="filter-action"
              type="text"
              placeholder="e.g. crewing"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); resetPage(); }}
              className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <Label htmlFor="filter-entity" className="text-xs">Entity Type</Label>
            <input
              id="filter-entity"
              type="text"
              placeholder="e.g. shift_crewing"
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); resetPage(); }}
              className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <Label htmlFor="filter-user" className="text-xs">User ID</Label>
            <input
              id="filter-user"
              type="text"
              placeholder="user_..."
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); resetPage(); }}
              className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <Label htmlFor="filter-start" className="text-xs">From</Label>
            <input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); resetPage(); }}
              className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <Label htmlFor="filter-end" className="text-xs">To</Label>
            <input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); resetPage(); }}
              className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
        {hasFilters && (
          <div className="mb-3">
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
              Clear filters
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className={isFetching ? "opacity-60" : ""}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.user_name ? (
                        <span title={log.user_id}>{log.user_name}</span>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {log.user_id || "System"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.action.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Badge>{log.entity_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {formatDetails(log.details)}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">
                        {hasFilters ? "No events match these filters" : "No activity logs yet"}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination footer */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              Showing {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of{" "}
              {total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!canGoNext || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Render a `details` payload as a compact, readable string. Handles the current
 * logger quirk where details may arrive as a JSON-encoded string rather than
 * an object (see logger.ts double-encoding bug). Falls back to JSON.stringify
 * for anything we can't parse.
 */
function formatDetails(details: unknown): string {
  if (details === null || details === undefined || details === "") return "—";
  let parsed: unknown = details;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return parsed as string; }
  }
  if (typeof parsed !== "object" || parsed === null) return String(parsed);
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ");
}
