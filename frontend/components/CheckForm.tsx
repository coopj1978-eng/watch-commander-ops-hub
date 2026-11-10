import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { currentDayNight } from "@/lib/shiftRota";
import { useBoardDefects } from "@/components/J4Board";
import { outstanding } from "@/lib/j4Board";
import { format } from "date-fns";

interface CheckItemState {
  equipment_item_id: number;
  name: string;
  category: string;
  serial_number: string | null;
  expected_quantity: number;
  status: "OK" | "Defective" | "Missing";
  quantity_checked: number;
  notes: string;
  /** Already on the J4 board (since this date) — it starts as missing or defective, not OK. */
  onBoardSince?: string;
}

type ItemStatus = CheckItemState["status"];

// The three answers for each item: labelled, 44px tall (Nov 2026, council
// phone polish — they were bare 32px icons).
const STATUS_BUTTONS: { value: ItemStatus; label: string; Icon: typeof CheckCircle2; on: string }[] = [
  { value: "OK", label: "OK", Icon: CheckCircle2, on: "border-green-600 bg-green-600 text-white" },
  { value: "Defective", label: "Defect", Icon: AlertTriangle, on: "border-amber-600 bg-amber-600 text-white" },
  { value: "Missing", label: "Missing", Icon: XCircle, on: "border-red-600 bg-red-600 text-white" },
];

/** The shift this check is for, from the watch's rota (the clock if there's no rota). */
function shiftNow(watch: string | undefined): "Day" | "Night" {
  const h = new Date().getHours();
  return currentDayNight(watch) ?? (h >= 8 && h < 18 ? "Day" : "Night");
}

interface CheckFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applianceId: number;
  applianceName: string;
}

export default function CheckForm({
  open,
  onOpenChange,
  applianceId,
  applianceName,
}: CheckFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [watch, setWatch] = useState<"Day" | "Night">(() => shiftNow(user?.watch_unit));
  useEffect(() => {
    if (open) setWatch(shiftNow(user?.watch_unit));
  }, [open, user?.watch_unit]);
  const [notes, setNotes] = useState("");
  const [checkItems, setCheckItems] = useState<CheckItemState[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: equipmentData, isLoading } = useQuery({
    queryKey: ["equipment", applianceId],
    queryFn: async () => {
      const result = await backend.appliance.listEquipment({
        appliance_id: applianceId,
      });
      return result;
    },
    enabled: open,
  });

  // What's already on the J4 board for this appliance's kit: those items
  // start as missing or defective, so the check agrees with the board.
  const { data: boardDefects, isLoading: boardLoading } = useBoardDefects();

  // Initialize check items when equipment data loads
  if (equipmentData?.items && boardDefects && !initialized) {
    const onBoard = new Map(
      boardDefects
        .filter((d) => outstanding(d) && d.defect_type === "equipment" && d.appliance_id === applianceId)
        .map((d) => [d.equipment_item_id, d] as const),
    );
    setCheckItems(
      equipmentData.items.map((item) => {
        const line = onBoard.get(item.id);
        const missing = !!line && /missing/i.test(`${line.title ?? ""} ${line.description}`);
        return {
          equipment_item_id: item.id,
          name: item.name,
          category: item.category,
          serial_number: item.serial_number,
          expected_quantity: item.quantity,
          status: line ? (missing ? ("Missing" as const) : ("Defective" as const)) : ("OK" as const),
          quantity_checked: line && missing ? 0 : item.quantity,
          notes: "",
          onBoardSince: line?.reported_at,
        };
      })
    );
    setInitialized(true);
  }

  // Reset when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setInitialized(false);
      setCheckItems([]);
      setNotes("");
    }
    onOpenChange(isOpen);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      return await backend.appliance.startCheck({
        appliance_id: applianceId,
        watch,
        notes: notes || undefined,
        items: checkItems.map((item) => ({
          equipment_item_id: item.equipment_item_id,
          status: item.status,
          quantity_checked: item.quantity_checked,
          notes: item.notes || undefined,
        })),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      // The check ticks its line on this shift's task card.
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      const added = data.defects_created;
      const ticked = (data.task_lines_ticked ?? []).length > 0;
      toast({
        title: `J4 check complete · ${applianceName}`,
        description: [
          `${checkItems.length} items checked.`,
          added > 0 ? `${added} ${added === 1 ? "item" : "items"} added to the J4 board.` : "",
          ticked ? "Ticked on this shift's task card." : "",
        ].filter(Boolean).join(" "),
      });
      handleOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to submit check:", error);
      toast({
        title: "Failed to submit check",
        variant: "destructive",
      });
    },
  });

  const updateItem = (index: number, updates: Partial<CheckItemState>) => {
    setCheckItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  // Everything OK — except what's on the J4 board, which stays as it is
  // until someone looks at it and says it's back.
  const markAllOK = () => {
    setCheckItems((prev) =>
      prev.map((item) =>
        item.onBoardSince
          ? item
          : { ...item, status: "OK" as const, quantity_checked: item.expected_quantity, notes: "" }
      )
    );
  };

  // Group items by category
  const groupedItems: Record<string, { items: CheckItemState[]; indices: number[] }> = {};
  checkItems.forEach((item, index) => {
    if (!groupedItems[item.category]) {
      groupedItems[item.category] = { items: [], indices: [] };
    }
    groupedItems[item.category].items.push(item);
    groupedItems[item.category].indices.push(index);
  });

  const categoryLabels: Record<string, string> = {
    BA: "Breathing Apparatus",
    Ladders: "Ladders",
    Hose: "Hose",
    TIC: "Thermal Imaging",
    PPE: "PPE",
    Tools: "Tools",
    Medical: "Medical",
    Other: "Other",
  };

  const defectiveCount = checkItems.filter(
    (i) => i.status === "Defective" || i.status === "Missing"
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl pb-0">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="flex items-start gap-2 leading-snug">
            <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <span className="min-w-0 break-words">J4 check · {applianceName}</span>
          </DialogTitle>
          <DialogDescription>
            Mark each item. Anything defective or missing goes on the J4 board, and finishing the check ticks it off on this shift's task card.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Shift — from the rota, changeable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label id="j4-shift">Shift</Label>
              <div role="radiogroup" aria-labelledby="j4-shift" className="mt-1.5 flex gap-2">
                {(["Day", "Night"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={watch === s}
                    onClick={() => setWatch(s)}
                    className={cn(
                      "h-11 flex-1 rounded-lg border text-sm font-medium transition-colors",
                      watch === s ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
                    )}
                  >
                    {s} shift
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={markAllOK}
                className="h-11 w-full"
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Mark All OK
              </Button>
            </div>
          </div>

          {/* Equipment items by category */}
          {isLoading || boardLoading ? (
            <p className="text-muted-foreground text-center py-8">
              Loading equipment...
            </p>
          ) : (
            Object.entries(groupedItems).map(([category, group]) => (
              <div key={category} className="space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground border-b pb-2">
                  {categoryLabels[category] || category}
                </h3>
                {group.items.map((item, groupIdx) => {
                  const globalIdx = group.indices[groupIdx];
                  return (
                    <div
                      key={item.equipment_item_id}
                      className={`rounded-lg border p-3 transition-colors ${
                        item.status === "Defective"
                          ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
                          : item.status === "Missing"
                          ? "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
                          : "border-border"
                      }`}
                    >
                      {/* Name and quantity on one line; the three answers
                          underneath on a phone, beside them on a wider screen. */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            {item.serial_number && (
                              <Badge variant="outline" className="text-xs">
                                S/N: {item.serial_number}
                              </Badge>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Label htmlFor={`qty-${item.equipment_item_id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                              Qty
                            </Label>
                            <Input
                              id={`qty-${item.equipment_item_id}`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={item.quantity_checked}
                              onChange={(e) =>
                                updateItem(globalIdx, {
                                  quantity_checked: parseInt(e.target.value) || 0,
                                })
                              }
                              className="h-10 w-16 text-center"
                            />
                            <span className="text-xs text-muted-foreground">
                              / {item.expected_quantity}
                            </span>
                          </div>
                        </div>

                        <div role="radiogroup" aria-label={`${item.name}: status`} className="grid grid-cols-3 gap-1.5 sm:flex sm:w-auto">
                          {STATUS_BUTTONS.map(({ value, label, Icon, on }) => (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={item.status === value}
                              onClick={() => updateItem(globalIdx, { status: value })}
                              className={cn(
                                "flex h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                                item.status === value ? on : "border-border text-foreground hover:bg-muted",
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" aria-hidden />
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {item.onBoardSince && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {item.status === "OK"
                            ? "This is on the J4 board. If it's back, tell your Watch or Crew Commander so they can clear it."
                            : `On the J4 board since ${format(new Date(item.onBoardSince), "d MMM")}. It won't be added again.`}
                        </p>
                      )}

                      {/* Notes field for defective/missing items */}
                      {(item.status === "Defective" ||
                        item.status === "Missing") && (
                        <div className="mt-2">
                          <Input
                            placeholder={`Describe the ${item.status === "Defective" ? "defect" : "issue"}...`}
                            value={item.notes}
                            onChange={(e) =>
                              updateItem(globalIdx, { notes: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {/* Overall notes */}
          <div>
            <Label htmlFor="check-notes">Check Notes (optional)</Label>
            <Textarea
              id="check-notes"
              placeholder="Any general notes about this check..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Pinned to the bottom of the scrolling form, so it's always in reach. */}
        <DialogFooter className="sticky bottom-0 -mx-6 flex-row items-center justify-between sm:justify-between gap-2 border-t bg-background px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0">
            {defectiveCount > 0 && (
              <Badge variant="destructive">
                {defectiveCount} issue{defectiveCount !== 1 ? "s" : ""} found
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || checkItems.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitMutation.isPending ? "Submitting…" : "Complete check"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
