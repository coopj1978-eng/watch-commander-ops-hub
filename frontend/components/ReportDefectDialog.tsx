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
import { AlertTriangle, Loader2, Truck, Wrench, Building2 } from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// ReportDefectDialog
//
// Standalone defect reporting (i.e. outside a J4 check). Supports three types:
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

  const [defectType,    setDefectType]    = useState<DefectType>("equipment");
  const [applianceId,   setApplianceId]   = useState<string>("");
  const [equipmentId,   setEquipmentId]   = useState<string>("");
  const [location,      setLocation]      = useState<string>("");
  const [title,         setTitle]         = useState<string>("");
  const [description,   setDescription]   = useState<string>("");

  // Reset form whenever the dialog opens so each report starts clean.
  useEffect(() => {
    if (open) {
      setDefectType("equipment");
      setApplianceId(defaultApplianceId ? String(defaultApplianceId) : "");
      setEquipmentId("");
      setLocation("");
      setTitle("");
      setDescription("");
    }
  }, [open, defaultApplianceId]);

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
    if (!title.trim() || !description.trim()) return false;
    if (defectType === "equipment") return !!applianceId && !!equipmentId;
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
      }),
    onSuccess: () => {
      toast({
        title: "Defect reported",
        description: "Added to the open defects list.",
      });
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      onReported?.();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({
        title: "Could not report defect",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Report Defect
          </DialogTitle>
          <DialogDescription>
            Log a fault outside of the J4 check flow — equipment, appliance, or
            station infrastructure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Type picker — pill row so the three options are immediately obvious */}
          <div className="space-y-1.5">
            <Label>Defect Type *</Label>
            <div className="grid grid-cols-3 gap-2">
              <TypePill
                active={defectType === "equipment"}
                label="Equipment"
                icon={<Wrench className="h-4 w-4" />}
                onClick={() => setDefectType("equipment")}
              />
              <TypePill
                active={defectType === "appliance"}
                label="Appliance"
                icon={<Truck className="h-4 w-4" />}
                onClick={() => setDefectType("appliance")}
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

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Short Summary *</Label>
            <Input
              placeholder={
                defectType === "equipment" ? "e.g. Low-pressure warning" :
                defectType === "appliance" ? "e.g. Engine warning light" :
                                             "e.g. Bay door stuck open"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Details *</Label>
            <Textarea
              rows={4}
              placeholder="Describe the fault — what's happening, when it started, any error messages or visible damage…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!valid || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reporting…</>
              ) : (
                <><AlertTriangle className="h-4 w-4 mr-2" />Report Defect</>
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
          ? "bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
          : "bg-muted/30 border-border text-muted-foreground hover:border-muted-foreground/40"
      }`}
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
