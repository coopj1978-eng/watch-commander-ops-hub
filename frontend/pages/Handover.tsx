import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ClipboardList, Users, Plus, ChevronDown, ChevronUp, Trash2, Pencil, Shield, Clock, Calendar, Printer, Wand2, MapPin, Trophy, History, AlertCircle } from "lucide-react";
import { formatDistanceToNow, parseISO, format, differenceInDays } from "date-fns";
import { useUserRole } from "@/lib/rbac";
import CrewingBoard from "@/components/CrewingBoard";
import { getTodayShift, getShiftsForDateRange, hasRotaConfig } from "@/lib/shiftRota";

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;
type WatchName = typeof WATCHES[number];

interface HandoverFormData {
  watch: WatchName | "";
  shift_type: "Day" | "Night";
  shift_date: string;
  incidents: string;
  outstanding_tasks: string;
  equipment_notes: string;
  staff_notes: string;
  general_notes: string;
}

const emptyForm: HandoverFormData = {
  watch: "",
  shift_type: "Day",
  shift_date: new Date().toISOString().split("T")[0],
  incidents: "",
  outstanding_tasks: "",
  equipment_notes: "",
  staff_notes: "",
  general_notes: "",
};

type Tab = "crewing" | "handover" | "detachments";

const PAGE_SIZE = 20;

// ── Detachments helpers ───────────────────────────────────────────────────────

const DET_PAGE_SIZE = 30;

function daysAgoLabel(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const days = differenceInDays(new Date(), parseISO(dateStr));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `${days} days ago`;
}

function DetachmentsTabPanel({ watch }: { watch: string }) {
  const [subTab, setSubTab] = useState<"rota" | "history">("rota");
  const [historyPage, setHistoryPage] = useState(0);

  const rotaQuery = useQuery({
    queryKey: ["detachments-rota", watch],
    queryFn: () => backend.detachments.getRota({ watch }),
    enabled: !!watch,
  });

  const historyQuery = useQuery({
    queryKey: ["detachments-history", watch, historyPage],
    queryFn: () => backend.detachments.list({
      watch: watch || undefined,
      limit: DET_PAGE_SIZE,
      offset: historyPage * DET_PAGE_SIZE,
    }),
    enabled: !!watch,
  });

  const members = rotaQuery.data?.members ?? [];
  const records = historyQuery.data?.detachments ?? [];
  const total   = historyQuery.data?.total ?? 0;
  const hasMore = (historyPage + 1) * DET_PAGE_SIZE < total;

  if (!watch) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No watch assigned to your profile
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tab pills */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setSubTab("rota")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            subTab === "rota"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          Fairness Rota
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            subTab === "history"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      {/* ── Fairness Rota ── */}
      {subTab === "rota" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Sorted by last detachment — <strong>top of the list = most overdue to go out next</strong>
          </p>

          {rotaQuery.isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : members.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No members found for {watch} Watch</div>
          ) : (
            <div className="space-y-1.5">
              {members.map((m, idx) => {
                const isNext   = idx === 0;
                const neverOut = !m.last_detachment_date;
                const days     = m.last_detachment_date
                  ? differenceInDays(new Date(), parseISO(m.last_detachment_date))
                  : null;
                return (
                  <div
                    key={m.firefighter_id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                      isNext
                        ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700"
                        : "bg-background border-border/50 hover:bg-muted/30"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isNext ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                    }`}>{idx + 1}</span>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {m.firefighter_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{m.firefighter_name}</span>
                        {isNext && <Badge className="text-[10px] py-0 px-1.5 bg-amber-500 text-white border-0 shrink-0">Next in line</Badge>}
                        {neverOut && <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground shrink-0">Never detached</Badge>}
                      </div>
                      {m.last_to_station && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          Last: {m.last_to_station}{m.last_reason && ` · ${m.last_reason}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-foreground">
                        {m.last_detachment_date ? format(parseISO(m.last_detachment_date), "dd MMM yyyy") : "—"}
                      </p>
                      <p className={`text-[11px] ${days !== null && days < 30 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                        {daysAgoLabel(m.last_detachment_date)}
                        {m.total_detachments > 0 && ` · ${m.total_detachments}× total`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── History ── */}
      {subTab === "history" && (
        <div className="space-y-3">
          {historyQuery.isLoading && historyPage === 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : records.length === 0 && !historyQuery.isLoading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <History className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No detachment records for {watch} Watch yet</p>
              <p className="text-xs text-muted-foreground/60">Records are created when you drag a tile to the Detached zone on the crewing board</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{total} record{total !== 1 ? "s" : ""} total</p>
              <div className="space-y-1.5">
                {records.map(det => (
                  <div key={det.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border/50 bg-background hover:bg-muted/30 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                      {det.firefighter_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{det.firefighter_name}</span>
                        {det.reason && <span className="text-xs text-muted-foreground">{det.reason}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{det.to_station}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{format(parseISO(det.detachment_date), "dd MMM yyyy")}</span>
                      </div>
                      {det.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{det.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <Button variant="outline" size="sm" className="w-full gap-1.5"
                  onClick={() => setHistoryPage(p => p + 1)} disabled={historyQuery.isLoading}>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Load more ({total - (historyPage + 1) * DET_PAGE_SIZE} remaining)
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Handover() {
  const { user } = useAuth();
  const role = useUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = role === "WC" || role === "CC";

  const [activeTab, setActiveTab]     = useState<Tab>((searchParams.get("tab") as Tab) ?? "crewing");
  const [showForm, setShowForm]       = useState(false);
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editForm, setEditForm]       = useState<{ incidents: string; outstanding_tasks: string; equipment_notes: string; staff_notes: string; general_notes: string }>({ incidents: "", outstanding_tasks: "", equipment_notes: "", staff_notes: "", general_notes: "" });
  const [form, setForm]               = useState<HandoverFormData>(emptyForm);
  const [watchFilter, setWatchFilter] = useState<WatchName | "">("");
  const [limit, setLimit]             = useState(PAGE_SIZE);

  // ── Handovers query (respects watch filter + pagination) ──────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["handovers", watchFilter, limit],
    queryFn: async () => backend.handover.list({
      watch: watchFilter || undefined,
      limit,
      offset: 0,
    }),
  });

  // ── Open tasks query (for auto-import into new handover form) ─────────────
  const { data: tasksData } = useQuery({
    queryKey: ["tasks-for-handover"],
    queryFn: async () => (await backend.task.list({ limit: 200 })).tasks,
    enabled: showForm,
    staleTime: 60_000,
  });

  // ── Handle ?tab=handover&logTask=... deep-link from task completion ────────
  useEffect(() => {
    const tab = searchParams.get("tab");
    const logTask = searchParams.get("logTask");
    if (tab === "handover") {
      setActiveTab("handover");
      if (logTask && canWrite) {
        const h = new Date().getHours();
        const shiftType: "Day" | "Night" = (h >= 8 && h < 18) ? "Day" : "Night";
        setForm({
          ...emptyForm,
          watch: (user?.watch_unit as WatchName) || "",
          shift_type: shiftType,
          shift_date: new Date().toISOString().split("T")[0],
          general_notes: `Completed this watch:\n• ${decodeURIComponent(logTask)}`,
        });
        setShowForm(true);
        // Clear the search params so a refresh doesn't re-trigger
        setSearchParams({}, { replace: true });
      }
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: HandoverFormData) => {
      if (!data.watch) throw new Error("Watch is required");
      return backend.handover.create({
        watch:             data.watch,
        shift_type:        data.shift_type,
        shift_date:        data.shift_date,
        incidents:         data.incidents || undefined,
        outstanding_tasks: data.outstanding_tasks || undefined,
        equipment_notes:   data.equipment_notes || undefined,
        staff_notes:       data.staff_notes || undefined,
        general_notes:     data.general_notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handovers"] });
      queryClient.invalidateQueries({ queryKey: ["wc-latest-handover"] });
      setForm(emptyForm);
      setShowForm(false);
      toast({ title: "Handover saved", description: "The handover note has been recorded." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save handover. Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => backend.handover.deleteHandover(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handovers"] });
      queryClient.invalidateQueries({ queryKey: ["wc-latest-handover"] });
      toast({ title: "Handover deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof editForm }) =>
      backend.handover.update(id, {
        incidents:         data.incidents         || undefined,
        outstanding_tasks: data.outstanding_tasks || undefined,
        equipment_notes:   data.equipment_notes   || undefined,
        staff_notes:       data.staff_notes       || undefined,
        general_notes:     data.general_notes     || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handovers"] });
      queryClient.invalidateQueries({ queryKey: ["wc-latest-handover"] });
      setEditingId(null);
      toast({ title: "Handover updated", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update handover. Please try again.", variant: "destructive" });
    },
  });

  const handovers = data?.handovers ?? [];
  const total     = data?.total ?? 0;
  const hasMore   = handovers.length < total;

  // ── Smart "New Handover" opener ───────────────────────────────────────────
  const handleNewHandover = () => {
    const h = new Date().getHours();
    const shiftType: "Day" | "Night" = (h >= 8 && h < 18) ? "Day" : "Night";
    setForm({
      ...emptyForm,
      watch: (user?.watch_unit as WatchName) || "",
      shift_type: shiftType,
      shift_date: new Date().toISOString().split("T")[0],
    });
    setShowForm(true);
  };

  // ── Import open tasks into Outstanding Tasks field ────────────────────────
  const handleImportTasks = () => {
    const openTasks = ((tasksData ?? []) as any[])
      .filter((t: any) => {
        const s = (t.status ?? "").toLowerCase();
        return s !== "done" && !s.includes("done") && !s.includes("complete");
      })
      .map((t: any) => `• ${t.title}`)
      .join("\n");
    if (openTasks) {
      setForm(f => ({ ...f, outstanding_tasks: openTasks }));
      toast({ title: "Tasks imported", description: "Open tasks added to Outstanding Tasks." });
    } else {
      toast({ title: "No open tasks", description: "There are no open tasks to import." });
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-indigo-500" />
            Shift Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Crewing board and handover notes for each watch
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto print:hidden">
          {activeTab === "handover" && canWrite && !showForm && (
            <Button onClick={handleNewHandover}>
              <Plus className="h-4 w-4 mr-2" />
              New Handover
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()} title="Print handover">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* ── Context strip ───────────────────────────────────────────────── */}
      {(() => {
        const watchName = user?.watch_unit ?? "";
        const dateStr = new Date().toLocaleDateString("en-GB", {
          weekday: "short", day: "numeric", month: "short", year: "numeric",
        });

        // Derive shift label — rota is the source of truth for 1st/2nd designation.
        // Clock (08:00–18:00) is used only as a fallback for day/night boundary.
        const h2 = new Date().getHours();
        const clockLabel = h2 >= 8 && h2 < 18 ? "Day Shift" : "Night Shift";
        let shiftLabel: string = clockLabel;

        if (watchName && hasRotaConfig(watchName)) {
          const todayShift = getTodayShift(watchName);
          if (todayShift?.isLeave) {
            const from = new Date();
            from.setDate(from.getDate() + 1);
            const to = new Date();
            to.setDate(to.getDate() + 90);
            const upcoming = getShiftsForDateRange(watchName, from, to);
            const next = upcoming.find(s => s.shiftType === "1st Day");
            shiftLabel = next
              ? `Annual Leave — next shift ${new Date(next.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
              : "Annual Leave";
          } else if (!todayShift?.isWorking) {
            shiftLabel = "Rest Day";
          } else if (todayShift?.shiftType) {
            // Rota knows if it's 1st or 2nd Day/Night — use it
            shiftLabel = `${todayShift.shiftType} Shift`;
          }
        }

        return (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/60 text-sm -mt-2 print:hidden">
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
            <span className="h-4 w-px bg-border hidden sm:block" />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-foreground">{shiftLabel}</span>
            </span>
          </div>
        );
      })()}

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border pb-0 print:hidden">
        <TabButton
          active={activeTab === "crewing"}
          onClick={() => setActiveTab("crewing")}
          icon={<Users className="h-4 w-4" />}
          label="Crewing Board"
        />
        <TabButton
          active={activeTab === "handover"}
          onClick={() => setActiveTab("handover")}
          icon={<ClipboardList className="h-4 w-4" />}
          label="Handover Notes"
        />
        <TabButton
          active={activeTab === "detachments"}
          onClick={() => setActiveTab("detachments")}
          icon={<MapPin className="h-4 w-4" />}
          label="Detachments"
        />
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === "crewing" && (
        <CrewingBoard />
      )}

      {activeTab === "detachments" && (
        <DetachmentsTabPanel watch={user?.watch_unit ?? ""} />
      )}

      {activeTab === "handover" && (
        <div className="space-y-6">

          {/* ── Watch filter strip ──────────────────────────────────────── */}
          {!showForm && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">Filter:</span>
              {(["", ...WATCHES] as (WatchName | "")[]).map((w) => (
                <button
                  key={w || "all"}
                  onClick={() => { setWatchFilter(w); setLimit(PAGE_SIZE); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    watchFilter === w
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {w ? `${w} Watch` : "All Watches"}
                </button>
              ))}
              {!isLoading && (
                <span className="text-xs text-muted-foreground ml-2">
                  {total} record{total !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Create Form — hidden on print */}
          {showForm && canWrite && (
            <Card className="border-indigo-200 dark:border-indigo-900 handover-create-form">
              <CardHeader>
                <CardTitle>New Handover Note</CardTitle>
                <CardDescription>Record the end-of-watch handover for the incoming crew</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Watch / Shift / Date row */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Watch *</Label>
                    <Select
                      value={form.watch}
                      onValueChange={(v) => setForm((f) => ({ ...f, watch: v as WatchName }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select watch" /></SelectTrigger>
                      <SelectContent>
                        {WATCHES.map((w) => (
                          <SelectItem key={w} value={w}>{w} Watch</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Shift *</Label>
                    <Select
                      value={form.shift_type}
                      onValueChange={(v) => setForm((f) => ({ ...f, shift_type: v as "Day" | "Night" }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Day">Day</SelectItem>
                        <SelectItem value="Night">Night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={form.shift_date}
                      onChange={(e) => setForm((f) => ({ ...f, shift_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>General Notes</Label>
                  <Textarea
                    placeholder="Overall summary of the watch..."
                    rows={3}
                    value={form.general_notes}
                    onChange={(e) => setForm((f) => ({ ...f, general_notes: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    Incidents
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">optional</Badge>
                  </Label>
                  <Textarea
                    placeholder="Notable calls or incidents during the watch..."
                    rows={2}
                    value={form.incidents}
                    onChange={(e) => setForm((f) => ({ ...f, incidents: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-2">
                      Outstanding Tasks
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">optional</Badge>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1"
                      onClick={handleImportTasks}
                      title="Auto-fill with current open tasks"
                    >
                      <Wand2 className="h-3 w-3" />
                      Import open tasks
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Tasks left incomplete that the next watch needs to action..."
                    rows={2}
                    value={form.outstanding_tasks}
                    onChange={(e) => setForm((f) => ({ ...f, outstanding_tasks: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    Equipment / Defects
                    <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">optional</Badge>
                  </Label>
                  <Textarea
                    placeholder="Any defective kit, appliance issues, or defects raised..."
                    rows={2}
                    value={form.equipment_notes}
                    onChange={(e) => setForm((f) => ({ ...f, equipment_notes: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    Staff Notes
                    <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">optional</Badge>
                  </Label>
                  <Textarea
                    placeholder="Anything the incoming watch commander needs to know about personnel..."
                    rows={2}
                    value={form.staff_notes}
                    onChange={(e) => setForm((f) => ({ ...f, staff_notes: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate(form)}
                    disabled={!form.watch || !form.shift_date || createMutation.isPending}
                  >
                    {createMutation.isPending ? "Saving..." : "Save Handover"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Handover history */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent><Skeleton className="h-12 w-full" /></CardContent>
                </Card>
              ))}
            </div>
          ) : handovers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium text-foreground">No handover notes yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {canWrite
                    ? "Write the first handover note using the button above."
                    : "No handovers have been recorded."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {handovers.map((h) => {
                const isExpanded = expandedId === h.id;

                const timeAgo = formatDistanceToNow(parseISO(h.created_at), { addSuffix: true });
                const isOwn = h.written_by_user_id === user?.id;
                const wasEdited = Math.abs(
                  parseISO(h.updated_at).getTime() - parseISO(h.created_at).getTime()
                ) > 60_000; // edited if updated >60s after creation
                const editedAt = wasEdited
                  ? format(parseISO(h.updated_at), "HH:mm d MMM")
                  : null;

                return (
                  <Card key={h.id} className="transition-all">
                    <CardHeader
                      className="pb-3 cursor-pointer select-none"
                      onClick={() => setExpandedId(isExpanded ? null : h.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">
                              {format(parseISO(h.shift_date), "dd MMM yyyy")}
                            </span>
                            <Badge variant="outline" className="text-xs">{h.watch} Watch</Badge>
                            <Badge variant="secondary" className="text-xs">{h.shift_type}</Badge>
                            {h.incidents && <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-100">Incidents</Badge>}
                            {h.outstanding_tasks && <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">Outstanding Tasks</Badge>}
                            {h.equipment_notes && <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-100">Equipment</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            By {h.written_by_name ?? "Unknown"} · {timeAgo}
                            {editedAt && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/60">
                                edited {editedAt}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 handover-card-actions">
                          {(isOwn || role === "WC") && editingId !== h.id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-indigo-500"
                              title="Edit handover"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditForm({
                                  incidents:         h.incidents         ?? "",
                                  outstanding_tasks: h.outstanding_tasks ?? "",
                                  equipment_notes:   h.equipment_notes   ?? "",
                                  staff_notes:       h.staff_notes       ?? "",
                                  general_notes:     h.general_notes     ?? "",
                                });
                                setEditingId(h.id);
                                setExpandedId(h.id);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(isOwn || role === "WC") && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-red-500"
                              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(h.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          }
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className={`pt-0 border-t handover-card-body ${isExpanded ? "" : "hidden"}`}>
                      {editingId === h.id ? (
                        <div className="space-y-4 pt-4">
                          <EditField
                            label="General Notes"
                            value={editForm.general_notes}
                            onChange={(v) => setEditForm((f) => ({ ...f, general_notes: v }))}
                          />
                          <EditField
                            label="Incidents"
                            colour="orange"
                            value={editForm.incidents}
                            onChange={(v) => setEditForm((f) => ({ ...f, incidents: v }))}
                          />
                          <EditField
                            label="Outstanding Tasks"
                            colour="blue"
                            value={editForm.outstanding_tasks}
                            onChange={(v) => setEditForm((f) => ({ ...f, outstanding_tasks: v }))}
                          />
                          <EditField
                            label="Equipment / Defects"
                            colour="yellow"
                            value={editForm.equipment_notes}
                            onChange={(v) => setEditForm((f) => ({ ...f, equipment_notes: v }))}
                          />
                          <EditField
                            label="Staff Notes"
                            colour="purple"
                            value={editForm.staff_notes}
                            onChange={(v) => setEditForm((f) => ({ ...f, staff_notes: v }))}
                          />
                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              disabled={updateMutation.isPending}
                              onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: h.id, data: editForm }); }}
                            >
                              {updateMutation.isPending ? "Saving…" : "Save Changes"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 pt-0">
                          {h.general_notes    && <Section label="General Notes"      value={h.general_notes} />}
                          {h.incidents        && <Section label="Incidents"           value={h.incidents} colour="orange" />}
                          {h.outstanding_tasks && <Section label="Outstanding Tasks"  value={h.outstanding_tasks} colour="blue" />}
                          {h.equipment_notes  && <Section label="Equipment / Defects" value={h.equipment_notes} colour="yellow" />}
                          {h.staff_notes      && <Section label="Staff Notes"         value={h.staff_notes} colour="purple" />}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Load more */}
              {hasMore && (
                <div className="pt-2 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isFetching}
                    onClick={() => setLimit(l => l + PAGE_SIZE)}
                  >
                    {isFetching ? "Loading…" : `Load more (${total - handovers.length} remaining)`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, icon, label,
}: {
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

// ── Edit field helper ─────────────────────────────────────────────────────────

function EditField({ label, value, colour, onChange }: {
  label: string; value: string; colour?: string; onChange: (v: string) => void;
}) {
  const borderClass = colour === "orange" ? "border-orange-300 dark:border-orange-800"
    : colour === "blue"   ? "border-blue-300 dark:border-blue-800"
    : colour === "yellow" ? "border-yellow-300 dark:border-yellow-800"
    : colour === "purple" ? "border-purple-300 dark:border-purple-800"
    : "border-border";

  const labelClass = colour === "orange" ? "text-orange-600 dark:text-orange-400"
    : colour === "blue"   ? "text-blue-600 dark:text-blue-400"
    : colour === "yellow" ? "text-yellow-600 dark:text-yellow-400"
    : colour === "purple" ? "text-purple-600 dark:text-purple-400"
    : "text-muted-foreground";

  return (
    <div className={`pl-3 border-l-2 ${borderClass}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${labelClass}`}>{label}</p>
      <Textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm resize-none"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ── Section helper ───────────────────────────────────────────────────────────

function Section({ label, value, colour }: { label: string; value: string; colour?: string }) {
  const borderClass = colour === "orange" ? "border-orange-300 dark:border-orange-800"
    : colour === "blue"   ? "border-blue-300 dark:border-blue-800"
    : colour === "yellow" ? "border-yellow-300 dark:border-yellow-800"
    : colour === "purple" ? "border-purple-300 dark:border-purple-800"
    : "border-border";

  const labelClass = colour === "orange" ? "text-orange-600 dark:text-orange-400"
    : colour === "blue"   ? "text-blue-600 dark:text-blue-400"
    : colour === "yellow" ? "text-yellow-600 dark:text-yellow-400"
    : colour === "purple" ? "text-purple-600 dark:text-purple-400"
    : "text-muted-foreground";

  return (
    <div className={`pl-3 border-l-2 ${borderClass} mt-3`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${labelClass}`}>{label}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}
