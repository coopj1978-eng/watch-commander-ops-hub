import { useEffect, useState } from "react";
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
import { useSearchParams } from "react-router-dom";
import { DictionariesManager } from "@/components/DictionaryManager";
import { AbsenceThresholds } from "@/components/AbsenceThresholds";
import { InspectionPlans } from "@/components/InspectionPlans";
import { BrandingSettings } from "@/components/BrandingSettings";
import { useCanAccessAdmin, useIsAdmin } from "@/lib/rbac";
import { useFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";
import { useToast } from "@/components/ui/use-toast";
import {
  ShieldCheck,
  Users,
  Calendar,
  CheckSquare,
  Target,
  Navigation,
  Truck,
  ClipboardList,
  FileText,
  BarChart3,
  Save,
  FileCheck,
  Megaphone,
  GraduationCap,
  Flame,
  BookMarked,
} from "lucide-react";

// What firefighters (FF and RO) can open, phased in (John, 8 Nov 2026).
// Home, My profile and Settings are always on; WC and CC see everything.
const FEATURE_CONFIG: {
  key: keyof FeatureFlags;
  label: string;
  description: string;
  icon: React.ElementType;
  phase: string;
}[] = [
  { key: "calendar",     label: "Calendar",       description: "Their own calendar first, then the watch's; log TOIL and orange days, ask for a flexi or H4H", icon: Calendar,      phase: "Phase 1 · first release" },
  { key: "handover",     label: "Shift",          description: "Crewing board (to look at), handover notes to read, the rotas",       icon: ClipboardList, phase: "Phase 1 · first release" },
  { key: "tasks",        label: "Tasks",          description: "Today's shift board: tick checks, add a job",                         icon: CheckSquare,   phase: "Phase 1 · first release" },
  { key: "requests",     label: "Requests",       description: "Their own flexi and H4H requests, and recording the Kronos answer",   icon: FileCheck,     phase: "Phase 1 · first release" },
  { key: "detachments",  label: "Detachments",    description: "The detachment rota and history",                                     icon: Navigation,    phase: "Phase 1 · first release" },
  { key: "equipment",    label: "J4 Checks",      description: "Appliance checks and reporting defects",                              icon: Truck,         phase: "Phase 1 · first release" },
  { key: "bulletins",    label: "Bulletins",      description: "News and announcements",                                              icon: Megaphone,     phase: "Phase 2 · information" },
  { key: "training",     label: "Training",       description: "Training sessions and records",                                       icon: GraduationCap, phase: "Phase 2 · information" },
  { key: "policies",     label: "Docs",           description: "Policies, guidance and the policy question box",                      icon: FileText,      phase: "Phase 2 · information" },
  { key: "hydrants",     label: "Hydrants",       description: "Hydrant routes and faults",                                           icon: Flame,         phase: "Phase 3 · station work" },
  { key: "references",   label: "References",     description: "The watch's station references (and Our reference on Home)",         icon: BookMarked,    phase: "Phase 3 · station work" },
  { key: "targets",      label: "Targets",        description: "HFSV, community and multi-storey targets",                            icon: Target,        phase: "Phase 3 · station work" },
  { key: "people",       label: "People",         description: "Everyone's profiles",                                                 icon: Users,         phase: "WC/CC tools" },
  { key: "reports",      label: "Reports",        description: "Quarterly reports",                                                   icon: BarChart3,     phase: "WC/CC tools" },
];

// Station setup lives here (Nov 2026) — it used to share the Settings page
// with personal preferences. Every WC (and the admin) can open Admin;
// switching pages on/off and managing user accounts are the admin's alone.
// A CC gets the inspection plans only (John, 7 Nov 2026).
const PLANS_TAB = { value: "inspection-plans", label: "Inspection plans" };
const STATION_TABS = [
  { value: "skills", label: "Skills & certs" },
  { value: "absence", label: "Absence triggers" },
  PLANS_TAB,
  { value: "branding", label: "Branding" },
  { value: "activity", label: "Activity log" },
];
const ADMIN_TABS = [
  { value: "features", label: "Feature management" },
  { value: "users", label: "Users" },
];

export default function AdminPanel() {
  const isAdmin = useIsAdmin();
  const canSetUpStation = useCanAccessAdmin();
  const [params, setParams] = useSearchParams();
  const tabs = [...(canSetUpStation ? STATION_TABS : [PLANS_TAB]), ...(isAdmin ? ADMIN_TABS : [])];
  const asked = params.get("tab");
  const activeTab = tabs.some((t) => t.value === asked) ? asked! : tabs[0].value;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-indigo-500 shrink-0" />
          Admin
        </h1>
        {canSetUpStation && (
          <p className="text-muted-foreground mt-1">Station setup, activity log{isAdmin ? ", page switches and user accounts" : ""}</p>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(tab) => setParams({ tab }, { replace: true })}>
        {tabs.length > 1 && (
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <TabsList className="w-max">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>
        )}

        <TabsContent value="skills" className="mt-6 space-y-6">
          <DictionariesManager />
        </TabsContent>

        <TabsContent value="absence" className="mt-6 space-y-6">
          <AbsenceThresholds />
        </TabsContent>

        <TabsContent value="inspection-plans" className="mt-6 space-y-6">
          <InspectionPlans />
        </TabsContent>

        <TabsContent value="branding" className="mt-6 space-y-6">
          <BrandingSettings />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ActivityLogTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="features" className="mt-6">
            <FeatureManagementTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="users" className="mt-6">
            <AdminUsers />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function FeatureManagementTab() {
  const { flags, isLoaded, refetch } = useFeatureFlags();
  const { toast } = useToast();
  const [localFlags, setLocalFlags] = useState<FeatureFlags>(flags);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when flags load (opening /admin straight away would
  // otherwise start from the all-on defaults and save those).
  useEffect(() => {
    if (!hasChanges) setLocalFlags(flags);
  }, [flags, hasChanges]);

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
        description: "Saved. Firefighters see the change the next time they open the app.",
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
    setLocalFlags((prev) => {
      const allOn = { ...prev };
      FEATURE_CONFIG.forEach((f) => { allOn[f.key] = true; });
      return allOn;
    });
    setHasChanges(true);
  };

  const phases = [...new Set(FEATURE_CONFIG.map((f) => f.phase))];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>What firefighters see</CardTitle>
              <CardDescription className="mt-1">
                Which pages firefighters (FF and RO) can open. A page that's off is gone from their menu, their Home shortcuts and search, and won't open from a link. Home, My profile and Settings are always on. WC and CC always see everything.
              </CardDescription>
            </div>
            {hasChanges && (
              <Button onClick={handleSave} disabled={!isLoaded} className="bg-indigo-600 hover:bg-indigo-700">
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
                Turn on {phase.split(" · ")[0]}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={handleEnableAll} className="text-xs">
              Turn everything on
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
                    const isOn = localFlags[feature.key] ?? false;
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
                            {isOn ? "On" : "Off"}
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
