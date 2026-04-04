import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import {
  Home, Droplets, Building2, Shield, HeartPulse, CalendarPlus,
  ChevronRight, ChevronLeft, Loader2, Pencil, Trash2,
} from "lucide-react";
import { format } from "date-fns";

// ── Year / quarter helpers ────────────────────────────────────────────────────

/** Financial year (April-start) — used for HFSV / hydrant / community activity_records. */
function currentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Financial quarter (1=Apr–Jun, 2=Jul–Sep, 3=Oct–Dec, 4=Jan–Mar). */
function currentFinancialQuarter(): number {
  const m = new Date().getMonth();
  return Math.floor(((m - 3 + 12) % 12) / 3) + 1;
}

/** Calendar year — used for inspection_assignments (multistory / OI / care home). */
function currentCalendarYear(): number {
  return new Date().getFullYear();
}

/** Calendar quarter (1=Jan–Mar, 2=Apr–Jun, 3=Jul–Sep, 4=Oct–Dec). */
function currentCalendarQuarter(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

// ── Types ─────────────────────────────────────────────────────────────────────
type TemplateType = "hfsv" | "hydrant" | "multistory" | "operational" | "care_home" | "activity";

interface Template {
  type: TemplateType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  accent: string;
  eventColor: string;
}

/** Minimal shape of an existing CalendarEvent passed in for editing. */
export interface ExistingInspectionEvent {
  id: number;
  title: string;
  source_type?: string | null;
  source_id?: number | null;
  location?: string | null;
  start_time: string; // ISO
  end_time: string;   // ISO
  calendar_visibility: string;
  color?: string | null;
}

const TEMPLATES: Template[] = [
  { type: "hfsv",        label: "HFSV",                  description: "Home Fire Safety Visit — auto-assigns next available slot",       icon: Home,        color: "bg-orange-100 text-orange-700 border-orange-200", accent: "border-orange-500", eventColor: "#f97316" },
  { type: "hydrant",     label: "Hydrant Inspection",     description: "Annual hydrant inspection from your watch register",              icon: Droplets,    color: "bg-blue-100 text-blue-700 border-blue-200",       accent: "border-blue-500",   eventColor: "#3b82f6" },
  { type: "multistory",  label: "Multi-Story Inspection", description: "High-rise / multi-storey building inspection for this quarter",   icon: Building2,   color: "bg-purple-100 text-purple-700 border-purple-200", accent: "border-purple-500", eventColor: "#8b5cf6" },
  { type: "operational", label: "Operational Inspection", description: "OI — includes Care Home OIs and other risk premises",            icon: Shield,      color: "bg-indigo-100 text-indigo-700 border-indigo-200", accent: "border-indigo-500", eventColor: "#6366f1" },
  { type: "care_home",   label: "Care Home Validation",   description: "Care home validation inspection (separate from OI)",             icon: HeartPulse,  color: "bg-teal-100 text-teal-700 border-teal-200",       accent: "border-teal-500",   eventColor: "#14b8a6" },
  { type: "activity",    label: "Activity / Custom",      description: "Any other event — free text title and description",              icon: CalendarPlus,color: "bg-gray-100 text-gray-700 border-gray-200",       accent: "border-gray-400",   eventColor: "#6b7280" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
  /** When provided, the modal opens in edit mode for this existing event. */
  editingEvent?: ExistingInspectionEvent | null;
}

export default function InspectionEventModal({ open, onClose, defaultDate, editingEvent }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const watch = user?.watch_unit ?? "";
  // HFSV / hydrant / community use financial year + financial quarter (April-based)
  const fy = currentFinancialYear();
  const fq = currentFinancialQuarter();
  // inspection_assignments (multistory / OI / care_home) use calendar year + calendar quarter
  const calYear = currentCalendarYear();
  const calQuarter = currentCalendarQuarter();

  const isEditing = !!editingEvent;

  const [step, setStep] = useState<1 | 2>(1);
  const [template, setTemplate] = useState<Template | null>(null);

  // Step 2 form state
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [visibility, setVisibility] = useState<"watch" | "station">("watch");

  // ── Reset / pre-fill when opened ─────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Full reset on close
      setStep(1);
      setTemplate(null);
      setSelectedAssignmentId(null);
      setCustomTitle("");
      setAddress("");
      setDate(defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndTime("11:00");
      setVisibility("watch");
      return;
    }

    if (editingEvent) {
      // Edit mode — pre-fill everything from the existing event
      const srcType = (editingEvent.source_type ?? "activity") as TemplateType;
      setTemplate(TEMPLATES.find((t) => t.type === srcType) ?? TEMPLATES[TEMPLATES.length - 1]);
      setStep(2); // skip template picker

      setAddress(editingEvent.location ?? "");

      const st = new Date(editingEvent.start_time);
      const et = new Date(editingEvent.end_time);
      setDate(format(st, "yyyy-MM-dd"));
      setStartTime(format(st, "HH:mm"));
      setEndTime(format(et, "HH:mm"));
      setVisibility(editingEvent.calendar_visibility === "station" ? "station" : "watch");
    }
  }, [open, editingEvent?.id]);

  // ── HFSV: query next available slot (create mode) — uses FINANCIAL year/quarter ─
  const hfsvQuery = useQuery({
    queryKey: ["hfsv-pending", watch, fy, fq],
    queryFn: async () => {
      const r = await backend.activity.list({ type: "hfsv", watch, financial_year: fy, quarter: fq });
      return r.items.filter((i) => !i.completed).sort((a, b) => (a.item_number ?? 999) - (b.item_number ?? 999));
    },
    enabled: open && template?.type === "hfsv" && !isEditing && !!watch,
  });

  // ── HFSV: query existing slot in edit mode ───────────────────────────────
  const hfsvEditQuery = useQuery({
    queryKey: ["hfsv-slot", editingEvent?.source_id],
    queryFn: async () => {
      const r = await backend.activity.list({ type: "hfsv", watch, financial_year: fy });
      return r.items.find((i) => i.id === editingEvent!.source_id) ?? null;
    },
    enabled: open && isEditing && template?.type === "hfsv" && !!editingEvent?.source_id && !!watch,
  });

  // Auto-fill address from HFSV slot (create mode only)
  const nextHfsv = !isEditing ? (hfsvQuery.data?.[0] ?? null) : null;
  useEffect(() => {
    if (!isEditing && template?.type === "hfsv" && nextHfsv) {
      setSelectedAssignmentId(nextHfsv.id);
      if (nextHfsv.address) setAddress(nextHfsv.address);
    }
  }, [template?.type, nextHfsv?.id]);

  // ── Inspection assignments (create mode) — uses CALENDAR year/quarter ─────
  // inspection_assignments stores year as calendar year, quarters as Q1=Jan-Mar etc.
  // This is distinct from the financial year used for activity_records.
  const assignmentQuery = useQuery({
    queryKey: ["inspection-assignments-pending", template?.type, watch, calYear, calQuarter],
    queryFn: async () => {
      if (!template || template.type === "hfsv" || template.type === "activity") return { items: [] };
      const params = {
        plan_type: template.type as any,
        watch,
        year: calYear,
        status: "pending" as const,
        ...(template.type === "multistory" ? { quarter: calQuarter } : { quarter: 0 }),
      };
      console.log("[InspectionModal] listAssignments params:", params);
      const r = await backend.inspection_plans.listAssignments(params);
      console.log("[InspectionModal] listAssignments result:", r);
      return r;
    },
    enabled: open && !isEditing && !!template && template.type !== "hfsv" && template.type !== "activity" && !!watch,
  });

  const assignments = (assignmentQuery.data?.items ?? []) as any[];

  // Auto-fill address when assignment selected (create mode)
  useEffect(() => {
    if (!isEditing && selectedAssignmentId && assignments.length) {
      const a = assignments.find((x: any) => x.id === selectedAssignmentId);
      if (a) setAddress(a.label ?? "");
    }
  }, [selectedAssignmentId]);

  // ── Create mutation ──────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const t = template!;
      const startDt = new Date(`${date}T${startTime}:00`);
      const endDt   = new Date(`${date}T${endTime}:00`);

      const sourceType: string | null = t.type === "activity" ? null : t.type;
      let sourceId: number | null = selectedAssignmentId;

      let title = "";
      if (t.type === "hfsv") {
        title = nextHfsv
          ? `HFSV #${nextHfsv.item_number} — ${address || "Address TBC"}`
          : `HFSV — ${address || "Additional Visit"}`;
      } else if (t.type === "activity") {
        title = customTitle;
        sourceId = null;
      } else {
        const sel = selectedAssignmentId ? assignments.find((x: any) => x.id === selectedAssignmentId) : null;
        title = sel
          ? `${t.label} — ${sel.label ?? address}`
          : `${t.label} — ${address || "Additional"}`;
      }

      return backend.calendar.createInspectionEvent({
        source_type: sourceType as any,
        source_id: sourceId,
        title,
        location: address || undefined,
        start_time: startDt.toISOString() as any,
        end_time: endDt.toISOString() as any,
        calendar_visibility: visibility,
        watch,
        color: t.eventColor,
        assigned_by: user?.id ?? "",
        assigned_to: user?.id ?? "",
        due_date: startDt.toISOString() as any,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cal-watch"] });
      queryClient.invalidateQueries({ queryKey: ["cal-station"] });
      toast({ title: "Event & task created", description: "Added to your calendar and the task board." });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to create event", description: err?.message ?? String(err), variant: "destructive" }),
  });

  // ── Update mutation (edit mode) ──────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async () => {
      const startDt = new Date(`${date}T${startTime}:00`);
      const endDt   = new Date(`${date}T${endTime}:00`);

      // Rebuild title to include updated address for HFSV
      let newTitle: string | undefined;
      if (template?.type === "hfsv" && editingEvent) {
        const slotMatch = editingEvent.title.match(/^(HFSV #\d+)/);
        const prefix = slotMatch ? slotMatch[1] : "HFSV";
        newTitle = address ? `${prefix} — ${address}` : prefix;
      }

      // 1. Update the calendar event
      await backend.calendar.update(editingEvent!.id, {
        user_id: user?.id ?? "",
        updates: {
          ...(newTitle ? { title: newTitle } : {}),
          location: address || undefined,
          start_time: startDt.toISOString() as any,
          end_time: endDt.toISOString() as any,
        },
      });

      // 2. For HFSV: also update the linked activity_record address
      if (template?.type === "hfsv" && editingEvent?.source_id && address) {
        await backend.activity.update(editingEvent.source_id, { address });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cal-watch"] });
      queryClient.invalidateQueries({ queryKey: ["cal-station"] });
      queryClient.invalidateQueries({ queryKey: ["hfsv-pending"] });
      queryClient.invalidateQueries({ queryKey: ["hfsv-slot", editingEvent?.source_id] });
      toast({ title: "Event updated", description: "Inspection event saved." });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to save", description: err?.message ?? String(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await backend.calendar.deleteEvent(editingEvent!.id, { user_id: user?.id ?? "" });
    },
    onSuccess: () => {
      toast({ title: "Inspection event deleted" });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to delete", description: err?.message ?? String(err), variant: "destructive" }),
  });

  const isPending = isEditing ? updateMutation.isPending : createMutation.isPending;

  const canSubmit = (() => {
    if (!template) return false;
    if (isEditing) return !!date; // in edit mode, address is optional
    if (template.type === "activity") return customTitle.trim().length > 0 && !!date;
    if (template.type === "hfsv") return !!date;
    return !!date;
  })();

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            {isEditing
              ? <><Pencil className="h-4 w-4 text-indigo-500" /> Edit Inspection Event</>
              : <><CalendarPlus className="h-4 w-4 text-orange-500" /> New Inspection Event</>
            }
            {template && (
              <Badge variant="outline" className={`ml-auto text-xs ${template.color}`}>
                {template.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — Pick template (create mode only) */}
        {step === 1 && !isEditing && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground mb-3">Select the type of inspection to schedule:</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => { setTemplate(t); setStep(2); }}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all hover:shadow-sm hover:scale-[1.01] ${t.color} ${t.accent}`}
                >
                  <t.icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold leading-tight">{t.label}</div>
                    <div className="text-[10px] opacity-70 leading-snug mt-0.5">{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Details */}
        {step === 2 && template && (
          <div className="space-y-4 pt-1">

            {/* ── HFSV slot info ──────────────────────────────────────────── */}
            {template.type === "hfsv" && (
              <div className={`rounded-xl p-3 border-2 ${template.accent} bg-orange-50/60 dark:bg-orange-900/10`}>
                {isEditing ? (
                  /* Edit mode: show the existing slot info */
                  hfsvEditQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading slot info…
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-orange-700 mb-1">Linked slot:</p>
                      <p className="text-sm font-bold text-orange-800">
                        HFSV #{hfsvEditQuery.data?.item_number ?? "?"} — Q{fq} {fy}/{fy + 1}
                      </p>
                      <p className="text-[11px] text-orange-500 mt-0.5">Address is saved back to this HFSV record</p>
                    </>
                  )
                ) : (
                  /* Create mode: show next available slot */
                  hfsvQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading HFSV slots…
                    </div>
                  ) : !nextHfsv ? (
                    <div>
                      <p className="text-sm text-green-600 font-medium">All HFSV slots for Q{fq} are complete! ✓</p>
                      <p className="text-xs text-muted-foreground mt-1">You can still log an additional HFSV below.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-orange-700 mb-1">Auto-assigned:</p>
                      <p className="text-sm font-bold text-orange-800">HFSV #{nextHfsv.item_number} — Q{fq} {fy}/{fy + 1}</p>
                      <p className="text-[11px] text-orange-600 mt-0.5">
                        {hfsvQuery.data!.length} slot{hfsvQuery.data!.length !== 1 ? "s" : ""} remaining this quarter
                      </p>
                    </>
                  )
                )}
              </div>
            )}

            {/* ── Assignment info (edit mode — read-only banner) ─────────── */}
            {isEditing && template.type !== "hfsv" && template.type !== "activity" && (
              <div className={`rounded-xl p-3 border-2 ${template.accent} ${template.color} bg-opacity-30`}>
                <p className="text-xs font-semibold opacity-80 mb-1">Linked inspection:</p>
                <p className="text-sm font-bold leading-snug">{editingEvent?.title}</p>
                <p className="text-[11px] opacity-60 mt-0.5">Inspection record is locked — only address and schedule can be changed</p>
              </div>
            )}

            {/* ── Assignment picker (create mode only) ───────────────────── */}
            {!isEditing && template.type !== "hfsv" && template.type !== "activity" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Select from your {template.label} list</Label>
                {assignmentQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                    <p className="text-green-600 dark:text-green-400 font-medium">All {template.label} assignments complete! ✓</p>
                    <p className="text-muted-foreground mt-0.5">You can still log an additional {template.label.toLowerCase()} below.</p>
                  </div>
                ) : (
                  <Select
                    value={selectedAssignmentId?.toString() ?? ""}
                    onValueChange={(v) => setSelectedAssignmentId(Number(v))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Choose a location…" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments.map((a: any) => (
                        <SelectItem key={a.id} value={a.id.toString()}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* ── Custom activity title (create mode only) ─────────────── */}
            {!isEditing && template.type === "activity" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Event Title</Label>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Community engagement – Ruchill Park"
                />
              </div>
            )}

            {/* ── Address / Location ─────────────────────────────────────── */}
            {template.type !== "activity" && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Address / Location{" "}
                  <span className="text-muted-foreground font-normal">
                    {template.type === "hfsv" ? "(saved to HFSV record)" : "(optional)"}
                  </span>
                </Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 42 Springburn Road, Glasgow"
                  autoFocus={isEditing}
                />
              </div>
            )}

            {/* ── Date + Time ───────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-sm" />
              </div>
            </div>

            {/* ── Visibility ────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label className="text-xs">Visibility</Label>
              <div className="flex gap-2">
                {(["watch", "station"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      visibility === v
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {v === "watch" ? `${watch} Watch only` : "Whole Station"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center gap-2 pt-2">
          {/* Back only shown in create mode step 2 */}
          {step === 2 && !isEditing && (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}

          {/* Delete button shown only in edit mode */}
          {isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-red-500 hover:text-red-600 hover:bg-red-50"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Trash2 className="h-3.5 w-3.5 mr-1" />Delete Event</>
              }
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>

          {step === 1 && !isEditing && (
            <p className="text-xs text-muted-foreground">Select a template to continue</p>
          )}

          {step === 2 && (
            <Button
              size="sm"
              disabled={!canSubmit || isPending}
              onClick={() => isEditing ? updateMutation.mutate() : createMutation.mutate()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{isEditing ? "Saving…" : "Creating…"}</>
              ) : isEditing ? (
                <><Pencil className="h-3.5 w-3.5 mr-1" />Save Changes</>
              ) : (
                <><ChevronRight className="h-3.5 w-3.5 mr-1" />Create Event &amp; Task</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
