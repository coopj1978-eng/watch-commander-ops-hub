import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { useUserRole } from "@/lib/rbac";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  GraduationCap, Plus, Calendar, Clock, Users, CheckCircle2,
  Filter, ChevronDown, ChevronUp, X, Loader2, Shield,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import ScheduleTrainingDialog from "@/components/ScheduleTrainingDialog";

// ── Constants ────────────────────────────────────────────────────────────────

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;
type WatchName = (typeof WATCHES)[number];

const TRAINING_TYPE_LABELS: Record<string, string> = {
  ba_drill: "BA Drill",
  rtc: "RTC / Extrication",
  ladder: "Ladder Drill",
  water: "Water / Rescue",
  hazmat: "HAZMAT",
  first_aid: "First Aid",
  driver: "Driver Training",
  debrief: "Debrief",
  physical: "Physical Training",
  station_drill: "Station Drill",
  lecture: "Lecture / Theory",
  assessment: "Assessment",
  other: "Other",
};

const COMPETENCIES = [
  "BA", "PRPS", "Driver LGV", "Driver ERD",
  "First Aid", "Water", "HAZMAT", "RTC",
] as const;

const SHIFT_TYPES = [
  { value: "1st Day", label: "1st Day" },
  { value: "2nd Day", label: "2nd Day" },
  { value: "1st Night", label: "1st Night" },
  { value: "2nd Night", label: "2nd Night" },
];

const PAGE_SIZE = 20;

type Tab = "upcoming" | "history";

// ── Schedule Training form state ─────────────────────────────────────────────

interface ScheduleForm {
  training_date: string;
  training_type: string;
  topic: string;
  shift_type: string;
}

const emptyScheduleForm: ScheduleForm = {
  training_date: new Date().toISOString().split("T")[0],
  training_type: "",
  topic: "",
  shift_type: "",
};

// ── Log Training form state ──────────────────────────────────────────────────

interface ExternalAttendeeDraft {
  id: string;       // client-only uuid-ish key for react list rendering
  name: string;
  rank: string;
  station: string;
}

interface LogForm {
  duration_hours: string;
  notes: string;
  selectedUserIds: string[];
  externalAttendees: ExternalAttendeeDraft[];
  competencies: string[];
}

const emptyLogForm: LogForm = {
  duration_hours: "",
  notes: "",
  selectedUserIds: [],
  externalAttendees: [],
  competencies: [],
};

// ── Main component ───────────────────────────────────────────────────────────

export default function Training() {
  const { user } = useAuth();
  const role = useUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canEdit = role === "WC" || role === "CC";

  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [watchFilter, setWatchFilter] = useState<WatchName | "">(
    (user?.watch_unit as WatchName) || ""
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logRecordId, setLogRecordId] = useState<number | null>(null);
  const [logForm, setLogForm] = useState<LogForm>(emptyLogForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [upcomingLimit, setUpcomingLimit] = useState(PAGE_SIZE);
  const [historyLimit, setHistoryLimit] = useState(PAGE_SIZE);

  // ── Queries ──────────────────────────────────────────────────────────────

  const upcomingQuery = useQuery({
    queryKey: ["training", "planned", watchFilter, upcomingLimit],
    queryFn: () =>
      backend.training.list({
        watch: watchFilter || undefined,
        status: "planned",
        limit: upcomingLimit,
        offset: 0,
      }),
  });

  const historyQuery = useQuery({
    queryKey: ["training", "history", watchFilter, historyLimit],
    queryFn: () =>
      backend.training.list({
        watch: watchFilter || undefined,
        limit: historyLimit,
        offset: 0,
      }),
    // We want all non-planned for history — but API only filters one status.
    // We'll fetch all and filter client-side for completed+cancelled.
    select: (data) => ({
      records: data.records.filter((r) => r.status !== "planned"),
      total: data.total,
    }),
  });

  const rosterQuery = useQuery({
    queryKey: ["crewing-roster", watchFilter || user?.watch_unit],
    queryFn: () =>
      backend.crewing.roster({ watch: watchFilter || user?.watch_unit || "" }),
    enabled: logOpen && !!(watchFilter || user?.watch_unit),
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  // createMutation is handled inside ScheduleTrainingDialog.

  const updateMutation = useMutation({
    mutationFn: ({ id, ...params }: { id: number; status?: string; duration_hours?: number; notes?: string }) =>
      backend.training.update(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training"] });
    },
  });

  const attendanceMutation = useMutation({
    mutationFn: ({ id, ...params }: {
      id: number;
      user_ids: string[];
      externals?: { name: string; rank?: string; station?: string }[];
      competencies_covered?: string[];
      notes?: string;
    }) => backend.training.addAttendance(id, params),
  });

  const handleLogSubmit = async () => {
    if (!logRecordId) return;
    try {
      await updateMutation.mutateAsync({
        id: logRecordId,
        status: "completed",
        duration_hours: logForm.duration_hours ? parseFloat(logForm.duration_hours) : undefined,
        notes: logForm.notes || undefined,
      });

      const validExternals = logForm.externalAttendees
        .filter((e) => e.name.trim().length > 0)
        .map((e) => ({
          name: e.name.trim(),
          rank: e.rank.trim() || undefined,
          station: e.station.trim() || undefined,
        }));

      if (logForm.selectedUserIds.length > 0 || validExternals.length > 0) {
        await attendanceMutation.mutateAsync({
          id: logRecordId,
          user_ids: logForm.selectedUserIds,
          externals: validExternals.length > 0 ? validExternals : undefined,
          competencies_covered: logForm.competencies.length > 0 ? logForm.competencies : undefined,
          notes: logForm.notes || undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["training"] });
      setLogOpen(false);
      setLogRecordId(null);
      setLogForm(emptyLogForm);
      toast({ title: "Training logged", description: "Session marked as completed with attendance recorded." });
    } catch {
      toast({ title: "Error", description: "Failed to log training.", variant: "destructive" });
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await updateMutation.mutateAsync({ id, status: "cancelled" });
      toast({ title: "Training cancelled" });
    } catch {
      toast({ title: "Error", description: "Failed to cancel training.", variant: "destructive" });
    }
  };

  const openLogDialog = (recordId: number) => {
    setLogRecordId(recordId);
    setLogForm(emptyLogForm);
    setLogOpen(true);
  };

  // ── Derived data ─────────────────────────────────────────────────────────

  const upcoming = upcomingQuery.data?.records ?? [];
  const upcomingTotal = upcomingQuery.data?.total ?? 0;
  const history = historyQuery.data?.records ?? [];
  const historyTotal = historyQuery.data?.total ?? 0;
  const roster = rosterQuery.data?.members ?? [];

  const isSubmitting = updateMutation.isPending || attendanceMutation.isPending;

  // ── Context strip values ─────────────────────────────────────────────────

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-teal-500" />
            Training
          </h1>
          <p className="text-muted-foreground mt-1">
            Schedule drills, log sessions, and track attendance
          </p>
        </div>

        {canEdit && (
          <Button
            className="self-start sm:self-auto bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setScheduleOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Training
          </Button>
        )}
      </div>

      {/* ── Context strip ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/60 text-sm -mt-2">
        {user?.watch_unit && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <Shield className="h-3.5 w-3.5" />
            {user.watch_unit} Watch
          </span>
        )}
        <span className="h-4 w-px bg-border hidden sm:block" />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-foreground">{dateStr}</span>
        </span>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border pb-0">
        <TabButton
          active={activeTab === "upcoming"}
          onClick={() => setActiveTab("upcoming")}
          icon={<Calendar className="h-4 w-4" />}
          label="Upcoming"
        />
        <TabButton
          active={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="History"
        />
      </div>

      {/* ── Watch filter ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">
          <Filter className="h-3 w-3 inline mr-1" />
          Filter:
        </span>
        {(["", ...WATCHES] as (WatchName | "")[]).map((w) => (
          <button
            key={w || "all"}
            onClick={() => {
              setWatchFilter(w);
              setUpcomingLimit(PAGE_SIZE);
              setHistoryLimit(PAGE_SIZE);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              watchFilter === w
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            }`}
          >
            {w ? `${w} Watch` : "All Watches"}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === "upcoming" && (
        <UpcomingPanel
          records={upcoming}
          total={upcomingTotal}
          isLoading={upcomingQuery.isLoading}
          isFetching={upcomingQuery.isFetching}
          canEdit={canEdit}
          onLog={openLogDialog}
          onCancel={handleCancel}
          hasMore={upcoming.length < upcomingTotal}
          onLoadMore={() => setUpcomingLimit((l) => l + PAGE_SIZE)}
        />
      )}

      {activeTab === "history" && (
        <HistoryPanel
          records={history}
          total={historyTotal}
          isLoading={historyQuery.isLoading}
          isFetching={historyQuery.isFetching}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
          hasMore={history.length < historyTotal}
          onLoadMore={() => setHistoryLimit((l) => l + PAGE_SIZE)}
        />
      )}

      {/* ── Schedule Training dialog ────────────────────────────────────── */}
      <ScheduleTrainingDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        watch={watchFilter || user?.watch_unit || ""}
      />

      {/* ── Log Training dialog ─────────────────────────────────────────── */}
      <Dialog open={logOpen} onOpenChange={(open) => { if (!open) { setLogOpen(false); setLogRecordId(null); } }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Log Training
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Duration (hours)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 2"
                  value={logForm.duration_hours}
                  onChange={(e) => setLogForm((f) => ({ ...f, duration_hours: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes / Debrief</Label>
              <Textarea
                rows={3}
                placeholder="Summary of the session, key observations..."
                value={logForm.notes}
                onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Competencies */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Competencies Covered
              </Label>
              <div className="flex flex-wrap gap-2">
                {COMPETENCIES.map((comp) => {
                  const checked = logForm.competencies.includes(comp);
                  return (
                    <button
                      key={comp}
                      type="button"
                      onClick={() =>
                        setLogForm((f) => ({
                          ...f,
                          competencies: checked
                            ? f.competencies.filter((c) => c !== comp)
                            : [...f.competencies, comp],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        checked
                          ? "bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {checked && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                      {comp}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Attendees */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Attendees
                {logForm.selectedUserIds.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                    {logForm.selectedUserIds.length} selected
                  </Badge>
                )}
              </Label>

              {rosterQuery.isLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                </div>
              ) : roster.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">
                  No roster members found for this watch.
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-border/60 p-2">
                  {/* Select all */}
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = roster.map((m: any) => m.id);
                      const allSelected = allIds.every((id: string) => logForm.selectedUserIds.includes(id));
                      setLogForm((f) => ({
                        ...f,
                        selectedUserIds: allSelected ? [] : allIds,
                      }));
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                  >
                    <Checkbox
                      checked={roster.length > 0 && roster.every((m: any) => logForm.selectedUserIds.includes(m.id))}
                      className="pointer-events-none"
                    />
                    Select all ({roster.length})
                  </button>
                  <div className="h-px bg-border/50 my-1" />
                  {roster.map((member: any) => {
                    const checked = logForm.selectedUserIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() =>
                          setLogForm((f) => ({
                            ...f,
                            selectedUserIds: checked
                              ? f.selectedUserIds.filter((id) => id !== member.id)
                              : [...f.selectedUserIds, member.id],
                          }))
                        }
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          checked ? "bg-teal-50 dark:bg-teal-950/20" : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox checked={checked} className="pointer-events-none" />
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {member.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") ?? "?"}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <span className="font-medium truncate block">{member.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] py-0 shrink-0">
                          {member.system_role ?? member.role}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* External Attendees — firefighters from other watches/stations */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  External Attendees
                  {logForm.externalAttendees.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      {logForm.externalAttendees.length}
                    </Badge>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLogForm((f) => ({
                      ...f,
                      externalAttendees: [
                        ...f.externalAttendees,
                        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "", rank: "", station: "" },
                      ],
                    }))
                  }
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1 normal-case tracking-normal"
                >
                  <Plus className="h-3 w-3" />
                  Add person
                </button>
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Use this for firefighters visiting from other watches or stations.
              </p>

              {logForm.externalAttendees.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border/60 p-2">
                  {logForm.externalAttendees.map((ext) => (
                    <div key={ext.id} className="grid grid-cols-[1fr_auto] gap-2 items-start">
                      <div className="grid gap-1.5 sm:grid-cols-3">
                        <Input
                          placeholder="Name *"
                          value={ext.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLogForm((f) => ({
                              ...f,
                              externalAttendees: f.externalAttendees.map((x) =>
                                x.id === ext.id ? { ...x, name: val } : x
                              ),
                            }));
                          }}
                        />
                        <Input
                          placeholder="Rank"
                          value={ext.rank}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLogForm((f) => ({
                              ...f,
                              externalAttendees: f.externalAttendees.map((x) =>
                                x.id === ext.id ? { ...x, rank: val } : x
                              ),
                            }));
                          }}
                        />
                        <Input
                          placeholder="Watch / Station"
                          value={ext.station}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLogForm((f) => ({
                              ...f,
                              externalAttendees: f.externalAttendees.map((x) =>
                                x.id === ext.id ? { ...x, station: val } : x
                              ),
                            }));
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setLogForm((f) => ({
                            ...f,
                            externalAttendees: f.externalAttendees.filter((x) => x.id !== ext.id),
                          }))
                        }
                        className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setLogOpen(false); setLogRecordId(null); }}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={isSubmitting}
                onClick={handleLogSubmit}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />Complete Training</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Upcoming panel ───────────────────────────────────────────────────────────

function UpcomingPanel({
  records, total, isLoading, isFetching, canEdit,
  onLog, onCancel, hasMore, onLoadMore,
}: {
  records: any[]; total: number; isLoading: boolean; isFetching: boolean;
  canEdit: boolean; onLog: (id: number) => void; onCancel: (id: number) => void;
  hasMore: boolean; onLoadMore: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="py-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No upcoming training</p>
          <p className="text-sm text-muted-foreground mt-1">
            {canEdit
              ? "Schedule a training session using the button above."
              : "No training sessions have been planned yet."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{total} planned session{total !== 1 ? "s" : ""}</p>
      {records.map((r) => (
        <Card key={r.id} className="border-t-2 border-t-teal-500 transition-all hover:shadow-md">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">
                    {format(parseISO(r.training_date), "EEE dd MMM yyyy")}
                  </span>
                  <TypeBadge type={r.training_type} />
                  {r.shift_type && (
                    <Badge variant="secondary" className="text-xs">{r.shift_type}</Badge>
                  )}
                  {r.watch && (
                    <Badge variant="outline" className="text-xs">{r.watch} Watch</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{r.topic}</p>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 gap-1.5"
                    onClick={() => onLog(r.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Log Training
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-red-500"
                    onClick={() => onCancel(r.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {hasMore && (
        <div className="pt-2 text-center">
          <Button variant="outline" size="sm" disabled={isFetching} onClick={onLoadMore}>
            {isFetching ? "Loading..." : `Load more (${total - records.length} remaining)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({
  records, total, isLoading, isFetching,
  expandedId, onToggleExpand, hasMore, onLoadMore,
}: {
  records: any[]; total: number; isLoading: boolean; isFetching: boolean;
  expandedId: number | null; onToggleExpand: (id: number) => void;
  hasMore: boolean; onLoadMore: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="py-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No training history</p>
          <p className="text-sm text-muted-foreground mt-1">
            Completed sessions will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{records.length} record{records.length !== 1 ? "s" : ""}</p>
      {records.map((r) => {
        const isExpanded = expandedId === r.id;
        return (
          <HistoryCard
            key={r.id}
            record={r}
            isExpanded={isExpanded}
            onToggle={() => onToggleExpand(r.id)}
          />
        );
      })}

      {hasMore && (
        <div className="pt-2 text-center">
          <Button variant="outline" size="sm" disabled={isFetching} onClick={onLoadMore}>
            {isFetching ? "Loading..." : `Load more`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── History card with expand to show attendees ───────────────────────────────

function HistoryCard({ record: r, isExpanded, onToggle }: {
  record: any; isExpanded: boolean; onToggle: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["training-detail", r.id],
    queryFn: () => backend.training.get(r.id),
    enabled: isExpanded,
  });

  const attendees = detailQuery.data?.attendees ?? [];

  return (
    <Card className={`border-t-2 transition-all ${r.status === "cancelled" ? "border-t-red-400 opacity-70" : "border-t-teal-500"}`}>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">
                {format(parseISO(r.training_date), "dd MMM yyyy")}
              </span>
              <TypeBadge type={r.training_type} />
              <StatusBadge status={r.status} />
              {r.watch && (
                <Badge variant="outline" className="text-xs">{r.watch} Watch</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{r.topic}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {r.duration_hours && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {r.duration_hours}h
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {isExpanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 border-t">
          <div className="space-y-3 pt-3">
            {r.notes && (
              <div className="pl-3 border-l-2 border-teal-300 dark:border-teal-800">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-teal-600 dark:text-teal-400">
                  Notes
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{r.notes}</p>
              </div>
            )}

            <div className="pl-3 border-l-2 border-border">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Attendees
              </p>
              {detailQuery.isLoading ? (
                <div className="space-y-1.5">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-48" />)}
                </div>
              ) : attendees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance recorded</p>
              ) : (
                <div className="space-y-1.5">
                  {attendees.map((a: any, idx: number) => (
                    <div key={a.user_id ?? `ext-${idx}`} className="flex items-center gap-2 flex-wrap">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${
                        a.is_external
                          ? "bg-gradient-to-br from-amber-400 to-orange-500"
                          : "bg-gradient-to-br from-indigo-400 to-purple-600"
                      }`}>
                        {a.user_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") ?? "?"}
                      </div>
                      <span className="text-sm font-medium">
                        {a.external_rank ? `${a.external_rank} ` : ""}{a.user_name}
                      </span>
                      {a.is_external && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                          External{a.external_station ? ` · ${a.external_station}` : ""}
                        </Badge>
                      )}
                      {a.competencies_covered?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {a.competencies_covered.map((c: string) => (
                            <Badge key={c} variant="outline" className="text-[10px] py-0 px-1.5 text-teal-600 border-teal-300">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
        ${active
          ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

function TypeBadge({ type }: { type: string }) {
  const label = TRAINING_TYPE_LABELS[type] ?? type;
  return (
    <Badge className="text-xs bg-teal-100 text-teal-700 border-teal-300 hover:bg-teal-100 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700">
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <Badge className="text-xs bg-green-100 text-green-700 border-green-300 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Completed
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge className="text-xs bg-red-100 text-red-700 border-red-300 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300">
        <X className="h-3 w-3 mr-1" />
        Cancelled
      </Badge>
    );
  }
  return null;
}
