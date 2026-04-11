import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { useUserRole } from "@/lib/rbac";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarDays, Users, GraduationCap, ArrowLeftRight, Loader2, X, RefreshCw, Sun, Pencil, Clock,
} from "lucide-react";
import type { shift_adjustments } from "@/client";

type AdjType = shift_adjustments.ShiftAdjustmentType;

const TYPE_CONFIG: Record<AdjType, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  description: string;
  inbound?: boolean;
}> = {
  flexi: {
    label: "Flexi Day",
    icon: CalendarDays,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-700",
    description: "You are not available for your shift on this day.",
  },
  training: {
    label: "Training",
    icon: GraduationCap,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-700",
    description: "You are away on an individual training course on this day.",
  },
  h4h: {
    label: "Head for Head",
    icon: ArrowLeftRight,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-300 dark:border-purple-700",
    description: "Someone from another watch is covering your shift.",
  },
  flexi_payback: {
    label: "Flexi Payback",
    icon: RefreshCw,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-300 dark:border-teal-700",
    description: "You are covering a shift on another watch as a flexi payback.",
  },
  orange_day: {
    label: "Orange Day",
    icon: Sun,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-300 dark:border-orange-700",
    description: "You are working an additional day or night shift (Orange Day).",
  },
  toil: {
    label: "TOIL",
    icon: Clock,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-700",
    description: "Use your banked TOIL hours for a shift off. Someone covers for you and receives payment (min 4hrs).",
  },
};

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
}

export default function ShiftAdjustmentModal({ open, onClose, defaultDate }: Props) {
  const { user } = useAuth();
  const userRole = useUserRole();
  const isManager = ["WC", "CC"].includes(userRole);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = defaultDate
    ? defaultDate.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const [type, setType] = useState<AdjType | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [notes, setNotes] = useState("");

  // Edit mode
  const [editingId, setEditingId] = useState<number | null>(null);

  // H4H fields
  const [coverMode, setCoverMode] = useState<"roster" | "freetext">("roster");
  const [coverWatch, setCoverWatch] = useState("");
  const [coverUserId, setCoverUserId] = useState("");
  const [coverName, setCoverName] = useState("");

  // Inbound cover fields (flexi_payback)
  const [inboundWatch, setInboundWatch] = useState("");
  const [inboundShift, setInboundShift] = useState<"Day" | "Night">("Day");

  // Orange Day shift selector
  const [orangeShift, setOrangeShift] = useState<"Day" | "Night">("Day");

  // TOIL hours
  const [toilHours, setToilHours] = useState(4);

  // Log for another user (WC/CC only)
  const [forAnother, setForAnother] = useState(false);
  const [forWatch, setForWatch] = useState("");
  const [forUserId, setForUserId] = useState("");

  useEffect(() => {
    if (open) {
      const d = defaultDate ? defaultDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
      setStartDate(d);
      setEndDate(d);
      setType(null);
      setNotes("");
      setEditingId(null);
      setCoverMode("roster");
      setCoverWatch("");
      setCoverUserId("");
      setCoverName("");
      setInboundWatch("");
      setInboundShift("Day");
      setOrangeShift("Day");
      setToilHours(4);
      setForAnother(false);
      setForWatch("");
      setForUserId("");
    }
  }, [open, defaultDate]);

  // Fetch cover watch roster when selected
  const { data: coverRosterData } = useQuery({
    queryKey: ["crewing-roster", coverWatch],
    queryFn: () => backend.crewing.roster({ watch: coverWatch }),
    enabled: coverMode === "roster" && !!coverWatch,
  });
  const coverRoster = coverRosterData?.members ?? [];

  // Fetch roster for "log for another user" watch
  const { data: forRosterData } = useQuery({
    queryKey: ["crewing-roster", forWatch],
    queryFn: () => backend.crewing.roster({ watch: forWatch }),
    enabled: forAnother && !!forWatch,
  });
  const forRoster = forRosterData?.members ?? [];

  // Fetch existing adjustments for this user in the selected date range
  const { data: existingData } = useQuery({
    queryKey: ["shift-adjustments-mine", user?.id, startDate],
    queryFn: () => backend.shift_adjustments.list({ user_id: user!.id, start_date: startDate, end_date: endDate }),
    enabled: !!user?.id && open,
  });
  const existing = existingData?.adjustments ?? [];

  const createMutation = useMutation({
    mutationFn: () => {
      const covering_user_id = coverMode === "roster" && coverUserId ? coverUserId : undefined;
      const covering_name =
        coverMode === "roster" && coverUserId
          ? coverRoster.find(m => m.id === coverUserId)?.name
          : coverMode === "freetext" && coverName.trim()
          ? coverName.trim()
          : undefined;

      const isFlexiPayback = type === "flexi_payback";
      const isOrangeDay = type === "orange_day";

      const isToil = type === "toil";

      return backend.shift_adjustments.create({
        type: type!,
        start_date: `${startDate}T00:00:00.000Z`,
        end_date: `${endDate}T00:00:00.000Z`,
        covering_user_id: isFlexiPayback || isOrangeDay ? undefined : covering_user_id,
        covering_name:    isFlexiPayback || isOrangeDay ? undefined : covering_name,
        covering_watch:   isFlexiPayback ? inboundWatch || undefined : undefined,
        shift_day_night:  isFlexiPayback ? inboundShift : isOrangeDay ? orangeShift : undefined,
        toil_hours:       isToil ? toilHours : undefined,
        notes: notes.trim() || undefined,
        for_user_id: forAnother && forUserId ? forUserId : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments-mine"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({
        title: `${TYPE_CONFIG[type!].label} logged`,
        description: "Your Watch Commander has been notified.",
      });
      onClose();
    },
    onError: (err: any) =>
      toast({ title: "Failed to log", description: err?.message ?? String(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => backend.shift_adjustments.deleteAdjustment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments-mine"] });
      queryClient.invalidateQueries({ queryKey: ["cal-station"] });
      queryClient.invalidateQueries({ queryKey: ["cal-watch"] });
      queryClient.invalidateQueries({ queryKey: ["cal-personal"] });
      toast({ title: "Shift adjustment removed" });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const covering_user_id = coverMode === "roster" && coverUserId ? coverUserId : undefined;
      const covering_name =
        coverMode === "roster" && coverUserId
          ? coverRoster.find(m => m.id === coverUserId)?.name
          : coverMode === "freetext" && coverName.trim()
          ? coverName.trim()
          : undefined;

      return backend.shift_adjustments.update(editingId!, {
        start_date: `${startDate}T00:00:00.000Z`,
        end_date: `${endDate}T00:00:00.000Z`,
        ...(type === "h4h" ? { covering_user_id, covering_name } : {}),
        ...(type === "flexi_payback" ? { covering_watch: inboundWatch || undefined, shift_day_night: inboundShift } : {}),
        ...(type === "orange_day" ? { shift_day_night: orangeShift } : {}),
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["shift-adjustments-mine"] });
      queryClient.invalidateQueries({ queryKey: ["cal-station"] });
      queryClient.invalidateQueries({ queryKey: ["cal-watch"] });
      queryClient.invalidateQueries({ queryKey: ["cal-personal"] });
      toast({ title: "Shift adjustment updated" });
      setEditingId(null);
      setType(null);
    },
    onError: (err: any) =>
      toast({ title: "Failed to update", description: err?.message ?? String(err), variant: "destructive" }),
  });

  const startEditing = (a: any) => {
    setEditingId(a.id);
    setType(a.type);
    setStartDate(String(a.start_date).split("T")[0]);
    setEndDate(String(a.end_date).split("T")[0]);
    setNotes(a.notes ?? "");
    if (a.type === "h4h") {
      if (a.covering_user_id) {
        setCoverMode("roster");
        setCoverUserId(a.covering_user_id);
        // We need the watch to load roster — infer from existing data
        setCoverWatch(""); // User may need to re-select
        setCoverName(a.covering_name ?? "");
      } else {
        setCoverMode("freetext");
        setCoverName(a.covering_name ?? "");
      }
    }
    if (a.type === "flexi_payback") {
      setInboundWatch(a.covering_watch ?? "");
      setInboundShift(a.shift_day_night ?? "Day");
    }
    if (a.type === "orange_day") {
      setOrangeShift(a.shift_day_night ?? "Day");
    }
    if (a.type === "toil") {
      setToilHours(a.toil_hours ?? 4);
      if (a.covering_user_id) {
        setCoverMode("roster");
        setCoverUserId(a.covering_user_id);
        setCoverWatch("");
        setCoverName(a.covering_name ?? "");
      } else {
        setCoverMode("freetext");
        setCoverName(a.covering_name ?? "");
      }
    }
  };

  const canSubmit = (() => {
    if (!type) return false;
    if (!startDate || !endDate) return false;
    if (forAnother && !forUserId) return false;
    if (type === "h4h" || type === "toil") {
      if (coverMode === "roster") return !!coverWatch && !!coverUserId;
      return coverName.trim().length > 0;
    }
    if (type === "flexi_payback") {
      return !!inboundWatch;
    }
    // orange_day just needs Day/Night (always has a default)
    return true;
  })();

  const userWatch = user?.watch_unit ?? "";
  const otherWatches = WATCHES.filter(w => w !== userWatch);

  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-indigo-500" />
            {editingId ? "Edit Shift Adjustment" : "Log Shift Adjustment"}
          </DialogTitle>
          {userWatch && (
            <p className="text-xs text-muted-foreground mt-0.5">{userWatch} Watch · {user?.name}</p>
          )}
        </DialogHeader>

        <div className="px-5 py-4 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* ── Type selector (hidden in edit mode) ── */}
          {editingId && type ? (
            <div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${TYPE_CONFIG[type].border} ${TYPE_CONFIG[type].bg}`}>
              {(() => { const Icon = TYPE_CONFIG[type].icon; return <Icon className={`h-5 w-5 ${TYPE_CONFIG[type].color}`} />; })()}
              <span className={`text-sm font-semibold ${TYPE_CONFIG[type].color}`}>Editing: {TYPE_CONFIG[type].label}</span>
            </div>
          ) : (
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Off your watch</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["flexi", "training", "h4h", "toil"] as AdjType[]).map((key) => {
                const cfg = TYPE_CONFIG[key];
                const Icon = cfg.icon;
                const selected = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`
                      flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
                      ${selected
                        ? `${cfg.border} ${cfg.bg} ${cfg.color}`
                        : "border-border text-muted-foreground hover:border-indigo-300 hover:bg-muted/40"}
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-semibold leading-tight">{cfg.label}</span>
                  </button>
                );
              })}
            </div>

            <Label className="text-xs text-muted-foreground mb-2 mt-3 block">Additional shifts</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["flexi_payback", "orange_day"] as AdjType[]).map((key) => {
                const cfg = TYPE_CONFIG[key];
                const Icon = cfg.icon;
                const selected = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`
                      flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
                      ${selected
                        ? `${cfg.border} ${cfg.bg} ${cfg.color}`
                        : "border-border text-muted-foreground hover:border-indigo-300 hover:bg-muted/40"}
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-semibold leading-tight">{cfg.label}</span>
                  </button>
                );
              })}
            </div>

            {type && (
              <p className="text-xs text-muted-foreground mt-2 px-1">{TYPE_CONFIG[type].description}</p>
            )}
          </div>
          )}

          {type && (
            <>
              {/* ── Date range ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">First day</Label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
                    className="w-full h-8 rounded-lg border border-border px-2 text-sm bg-background outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Last day</Label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full h-8 rounded-lg border border-border px-2 text-sm bg-background outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* ── H4H / TOIL: covering person ── */}
              {(type === "h4h" || type === "toil") && (
                <div className="space-y-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/30 p-3">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-purple-500" />
                    <Label className="text-sm font-medium text-purple-700 dark:text-purple-300">Who is covering for you?</Label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCoverMode("roster")}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${coverMode === "roster" ? "border-purple-400 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold" : "border-border text-muted-foreground"}`}
                    >
                      From roster
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverMode("freetext")}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${coverMode === "freetext" ? "border-purple-400 bg-purple-100 text-purple-700 font-semibold" : "border-border text-muted-foreground"}`}
                    >
                      Type name
                    </button>
                  </div>

                  {coverMode === "roster" ? (
                    <div className="space-y-2">
                      <Select value={coverWatch} onValueChange={v => { setCoverWatch(v); setCoverUserId(""); }}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select their watch…" />
                        </SelectTrigger>
                        <SelectContent>
                          {otherWatches.map(w => (
                            <SelectItem key={w} value={w}>{w} Watch</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {coverWatch && (
                        <Select value={coverUserId} onValueChange={setCoverUserId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select person…" />
                          </SelectTrigger>
                          <SelectContent>
                            {coverRoster.length === 0 && (
                              <SelectItem value="_none" disabled>No roster found</SelectItem>
                            )}
                            {coverRoster.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} {m.rank ? `· ${m.rank}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ) : (
                    <Input
                      placeholder="e.g. FF Smith (Red Watch)"
                      value={coverName}
                      onChange={e => setCoverName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  )}
                </div>
              )}

              {/* ── Inbound cover: watch + shift (flexi payback only) ── */}
              {type === "flexi_payback" && (
                <div className="space-y-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/30 p-3">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-teal-500" />
                    <Label className="text-sm font-medium text-teal-700 dark:text-teal-300">Which watch are you covering?</Label>
                  </div>

                  <Select value={inboundWatch} onValueChange={setInboundWatch}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select watch…" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherWatches.map(w => (
                        <SelectItem key={w} value={w}>{w} Watch</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Shift</Label>
                    <div className="flex gap-2">
                      {(["Day", "Night"] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setInboundShift(s)}
                          className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${inboundShift === s ? "border-teal-400 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-semibold" : "border-border text-muted-foreground"}`}
                        >
                          {s} Shift
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Orange Day: just Day/Night selector ── */}
              {type === "orange_day" && (
                <div className="space-y-3 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/40 dark:bg-orange-950/30 p-3">
                  <div className="flex items-center gap-1.5">
                    <Sun className="h-4 w-4 text-orange-500" />
                    <Label className="text-sm font-medium text-orange-700 dark:text-orange-300">Which shift?</Label>
                  </div>
                  <div className="flex gap-2">
                    {(["Day", "Night"] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setOrangeShift(s)}
                        className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${orangeShift === s ? "border-orange-400 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-semibold" : "border-border text-muted-foreground"}`}
                      >
                        {s} Shift
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TOIL: hours selector ── */}
              {type === "toil" && (
                <div className="space-y-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/30 p-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    <Label className="text-sm font-medium text-emerald-700 dark:text-emerald-300">How many TOIL hours?</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={4}
                      max={12}
                      step={0.5}
                      value={toilHours}
                      onChange={e => setToilHours(Number(e.target.value))}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 w-16 text-right">{toilHours}hrs</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Minimum 4hrs. These hours will be deducted from your TOIL balance.</p>
                </div>
              )}

              {/* ── Log for another user (WC/CC only, create mode only) ── */}
              {isManager && !editingId && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forAnother}
                      onChange={e => { setForAnother(e.target.checked); setForWatch(""); setForUserId(""); }}
                      className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-medium text-muted-foreground">Log this for another user</span>
                  </label>

                  {forAnother && (
                    <div className="space-y-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 p-3">
                      <Select value={forWatch} onValueChange={v => { setForWatch(v); setForUserId(""); }}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select their watch…" />
                        </SelectTrigger>
                        <SelectContent>
                          {WATCHES.map(w => (
                            <SelectItem key={w} value={w}>{w} Watch</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {forWatch && (
                        <Select value={forUserId} onValueChange={setForUserId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select person…" />
                          </SelectTrigger>
                          <SelectContent>
                            {forRoster.length === 0 && (
                              <SelectItem value="_none" disabled>No members found</SelectItem>
                            )}
                            {forRoster.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} {m.rank ? `· ${m.rank}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Notes ── */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</Label>
                <Input
                  placeholder="e.g. Course at Training Centre"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex gap-2">
                {editingId && (
                  <Button
                    variant="outline"
                    className="flex-shrink-0"
                    onClick={() => { setEditingId(null); setType(null); }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  className="w-full"
                  disabled={!canSubmit || createMutation.isPending || updateMutation.isPending}
                  onClick={() => editingId ? updateMutation.mutate() : createMutation.mutate()}
                >
                  {(createMutation.isPending || updateMutation.isPending)
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {editingId ? "Saving…" : "Logging…"}</>
                    : editingId ? `Save Changes` : `Log ${TYPE_CONFIG[type].label}`
                  }
                </Button>
              </div>
            </>
          )}

          {/* ── Existing adjustments ── */}
          {existing.length > 0 && (
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Logged adjustments
              </p>
              {existing.map(a => {
                const cfg = TYPE_CONFIG[a.type];
                const Icon = cfg.icon;
                const sameDay = a.start_date === a.end_date;
                const dateStr = sameDay
                  ? fmt(String(a.start_date).split("T")[0])
                  : `${fmt(String(a.start_date).split("T")[0])} – ${fmt(String(a.end_date).split("T")[0])}`;
                return (
                  <div key={a.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${cfg.border} ${cfg.bg}`}>
                    <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{dateStr}</p>
                      {(a as any).toil_hours ? (
                        <p className="text-xs text-muted-foreground truncate">{(a as any).toil_hours}hrs · Cover: {a.covering_name}</p>
                      ) : (a as any).covering_watch ? (
                        <p className="text-xs text-muted-foreground truncate">{(a as any).covering_watch} Watch · {(a as any).shift_day_night ?? "Day"} Shift</p>
                      ) : a.covering_name ? (
                        <p className="text-xs text-muted-foreground truncate">Cover: {a.covering_name}</p>
                      ) : null}
                    </div>
                    <button
                      onClick={() => startEditing(a)}
                      className="shrink-0 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-indigo-500"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(a.id)}
                      disabled={deleteMutation.isPending}
                      className="shrink-0 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-500"
                      title="Delete"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
