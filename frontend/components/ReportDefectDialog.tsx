import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/App";
import { Loader2, Plus, Truck, Wrench, Building2 } from "lucide-react";

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"];
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ──────────────────────────────────────────────────────────────────────────────
// ReportDefectDialog
//
// Adds a line to the J4 board (outside a J4 check). Three kinds of line:
//
//   Equipment  — specific kit on a specific appliance (low-pressure BA set).
//   Appliance  — vehicle-level issue (warning light, hydraulic leak).
//   Station    — station / building infrastructure (bay door, boiler).
//
// The form shape adapts to the selected type so the user only sees relevant
// fields. The backend validates the same matrix and the DB constraint (mig
// 059) enforces it at rest.
// ──────────────────────────────────────────────────────────────────────────────

type DefectType = "equipment" | "appliance" | "station";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select this appliance when opening (e.g. from an appliance card). */
  defaultApplianceId?: number;
  /** Called after a successful submit so the parent can refetch its list. */
  onReported?: () => void;
}

export default function ReportDefectDialog({
  open,
  onOpenChange,
  defaultApplianceId,
  onReported,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // WC/CC can copy up a line that's already on the office board: its own
  // date, the watch that found it, and whether it's already on order.
  const canBackfill = user?.role === "WC" || user?.role === "CC";
  const ownWatch = WATCHES.find((w) => w.toLowerCase() === (user?.watch_unit ?? "").toLowerCase()) ?? "";

  const [j7,            setJ7]            = useState(false);
  const [reportedOn,    setReportedOn]    = useState(todayIso());
  const [watch,         setWatch]         = useState(ownWatch);
  const [ordered,       setOrdered]       = useState(false);
  // Typed in by default: most lines on the board are kit that isn't on a list.
  const [defectType,    setDefectType]    = useState<DefectType>("appliance");
  const [applianceId,   setApplianceId]   = useState<string>("");
  const [equipmentId,   setEquipmentId]   = useState<string>("");
  const [location,      setLocation]      = useState<string>("");
  const [title,         setTitle]         = useState<string>("");
  const [description,   setDescription]   = useState<string>("");

  // Reset form whenever the dialog opens so each report starts clean.
  useEffect(() => {
    if (open) {
      setDefectType("appliance");
      setJ7(false);
      setReportedOn(todayIso());
      setWatch(ownWatch);
      setOrdered(false);
      setApplianceId(defaultApplianceId ? String(defaultApplianceId) : "");
      setEquipmentId("");
      setLocation("");
      setTitle("");
      setDescription("");
    }
  }, [open, defaultApplianceId, ownWatch]);

  // Appliances — only needed when reporting equipment / appliance-level.
  const appliancesQuery = useQuery({
    queryKey: ["appliances"],
    queryFn: async () => backend.appliance.listAppliances({}),
    enabled: open && defectType !== "station",
  });
  const appliances = appliancesQuery.data?.appliances ?? [];

  // Equipment items — only needed when reporting an equipment defect and an
  // appliance has been picked.
  const equipmentQuery = useQuery({
    queryKey: ["equipment-items", applianceId],
    queryFn: async () =>
      backend.appliance.listEquipment({ appliance_id: Number(applianceId) }),
    enabled: open && defectType === "equipment" && !!applianceId,
  });
  const equipmentItems = equipmentQuery.data?.items ?? [];

  // Validation matrix — mirrors the backend and DB constraint.
  const valid = useMemo(() => {
    if (!title.trim()) return false;
    // Kit from the list: "Missing" says it all. Typed-in lines need remarks.
    if (defectType === "equipment") return !!applianceId && !!equipmentId;
    if (!description.trim()) return false;
    if (defectType === "appliance") return !!applianceId;
    return true; // station
  }, [defectType, applianceId, equipmentId, title, description]);

  const mutation = useMutation({
    mutationFn: () =>
      backend.appliance.reportDefect({
        defect_type: defectType,
        appliance_id:       defectType !== "station"   ? Number(applianceId) : undefined,
        equipment_item_id:  defectType === "equipment" ? Number(equipmentId) : undefined,
        location:           defectType === "station"   ? location.trim() || undefined : undefined,
        title: title.trim(),
        description: description.trim(),
        j7_raised: j7,
        ...(canBackfill
          ? {
              watch: watch || undefined,
              reported_on: reportedOn && reportedOn !== todayIso() ? reportedOn : undefined,
              status: ordered ? ("Ordered" as const) : undefined,
            }
          : {}),
      }),
    onSuccess: () => {
      toast({
        title: "Added to the J4 board",
        description: "Everyone on station can see it.",
      });
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      onReported?.();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({
        title: "Couldn't add it to the board",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to the J4 board</DialogTitle>
          <DialogDescription>
            Missing or defective kit, a fault on an appliance, or something in the station. Everyone can see the board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Type picker — pill row so the three options are immediately obvious */}
          <div className="space-y-1.5">
            <Label>What is it?</Label>
            <div className="grid grid-cols-3 gap-2">
              <TypePill
                active={defectType === "appliance"}
                label="On an appliance"
                icon={<Truck className="h-4 w-4" />}
                onClick={() => setDefectType("appliance")}
              />
              <TypePill
                active={defectType === "equipment"}
                label="Kit from the list"
                icon={<Wrench className="h-4 w-4" />}
                onClick={() => setDefectType("equipment")}
              />
              <TypePill
                active={defectType === "station"}
                label="Station"
                icon={<Building2 className="h-4 w-4" />}
                onClick={() => setDefectType("station")}
              />
            </div>
          </div>

          {/* Appliance (for equipment + appliance types) */}
          {defectType !== "station" && (
            <div className="space-y-1.5">
              <Label>Appliance *</Label>
              <Select
                value={applianceId}
                onValueChange={(v) => { setApplianceId(v); setEquipmentId(""); }}
                disabled={appliancesQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select appliance" />
                </SelectTrigger>
                <SelectContent>
                  {appliances.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.call_sign} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Equipment (only for equipment type) */}
          {defectType === "equipment" && (
            <div className="space-y-1.5">
              <Label>Equipment *</Label>
              <Select
                value={equipmentId}
                onValueChange={setEquipmentId}
                disabled={!applianceId || equipmentQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={applianceId ? "Select equipment" : "Pick an appliance first"} />
                </SelectTrigger>
                <SelectContent>
                  {equipmentItems.map((e: any) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}{e.serial_number ? ` (S/N ${e.serial_number})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Location (only for station type) */}
          {defectType === "station" && (
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input
                placeholder="e.g. Appliance Bay 2, Ops Office, Mess Kitchen"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          )}

          {/* Item (typed in) — or, for kit from the list, what's wrong with it */}
          <div className="space-y-1.5">
            <Label>{defectType === "equipment" ? "What's wrong *" : "Item *"}</Label>
            <Input
              placeholder={
                defectType === "equipment" ? "e.g. Missing, test expired" :
                defectType === "appliance" ? "e.g. Tool box, pager, warning light" :
                                             "e.g. Bay door"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>{defectType === "equipment" ? "Remarks" : "Remarks *"}</Label>
            <Textarea
              rows={3}
              placeholder="e.g. Missing, test expired, away for repair, replacement ordered"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* J7 */}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm">
            <Checkbox checked={j7} onCheckedChange={(v) => setJ7(v === true)} />
            <span>A J7 has gone in for this</span>
          </label>

          {/* WC/CC: copying a line up from the office board */}
          {canBackfill && (
            <div className="space-y-3 rounded-lg border border-dashed p-3">
              <p className="text-xs text-muted-foreground">Copying a line from the office board? Set when it went up and which watch found it.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="defect-date">Date</Label>
                  <Input id="defect-date" type="date" max={todayIso()} value={reportedOn} onChange={(e) => setReportedOn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Watch</Label>
                  <Select value={watch} onValueChange={setWatch}>
                    <SelectTrigger><SelectValue placeholder="Watch" /></SelectTrigger>
                    <SelectContent>
                      {WATCHES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex min-h-9 cursor-pointer items-center gap-3 text-sm">
                <Checkbox checked={ordered} onCheckedChange={(v) => setOrdered(v === true)} />
                <span>A replacement or repair is already ordered</span>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={!valid || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding…</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" />Add to the board</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TypePill({
  active, label, icon, onClick,
}: {
  active: boolean; label: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg border-2 transition-colors ${
        active
          ? "bg-brand/10 border-brand text-brand"
          : "bg-muted/30 border-border text-muted-foreground hover:border-muted-foreground/40"
      }`}
    >
      {icon}
      <span className="text-center text-xs font-semibold leading-tight">{label}</span>
    </button>
  );
}
