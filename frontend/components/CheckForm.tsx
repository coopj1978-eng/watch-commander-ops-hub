import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import backend from "@/lib/backend";

interface CheckItemState {
  equipment_item_id: number;
  name: string;
  category: string;
  serial_number: string | null;
  expected_quantity: number;
  status: "OK" | "Defective" | "Missing";
  quantity_checked: number;
  notes: string;
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
  const queryClient = useQueryClient();
  const [watch, setWatch] = useState<"Day" | "Night">("Day");
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

  // Initialize check items when equipment data loads
  if (equipmentData?.items && !initialized) {
    setCheckItems(
      equipmentData.items.map((item) => ({
        equipment_item_id: item.id,
        name: item.name,
        category: item.category,
        serial_number: item.serial_number,
        expected_quantity: item.quantity,
        status: "OK" as const,
        quantity_checked: item.quantity,
        notes: "",
      }))
    );
    setInitialized(true);
  }

  // Reset when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setInitialized(false);
      setCheckItems([]);
      setNotes("");
      setWatch("Day");
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
      const defects = data.defects_created;
      toast({
        title: "J4 Check Complete",
        description: `${applianceName} check submitted. ${checkItems.length} items checked${defects > 0 ? `, ${defects} defect(s) logged` : ""}.`,
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

  const markAllOK = () => {
    setCheckItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: "OK" as const,
        quantity_checked: item.expected_quantity,
        notes: "",
      }))
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-red-600" />
            J4 Equipment Check — {applianceName}
          </DialogTitle>
          <DialogDescription>
            Check each item and mark its status. Defective or missing items will
            be automatically logged as defects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Watch selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="watch">Watch / Shift *</Label>
              <Select
                value={watch}
                onValueChange={(v) => setWatch(v as "Day" | "Night")}
              >
                <SelectTrigger id="watch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Day">Day Shift</SelectItem>
                  <SelectItem value="Night">Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={markAllOK}
                className="w-full"
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Mark All OK
              </Button>
            </div>
          </div>

          {/* Equipment items by category */}
          {isLoading ? (
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
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            {item.serial_number && (
                              <Badge variant="outline" className="text-xs">
                                S/N: {item.serial_number}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            Qty
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity_checked}
                            onChange={(e) =>
                              updateItem(globalIdx, {
                                quantity_checked: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-16 h-8 text-center"
                          />
                          <span className="text-xs text-muted-foreground">
                            / {item.expected_quantity}
                          </span>
                        </div>

                        {/* Status buttons */}
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={item.status === "OK" ? "default" : "outline"}
                            className={
                              item.status === "OK"
                                ? "bg-green-600 hover:bg-green-700 h-8 px-2"
                                : "h-8 px-2"
                            }
                            onClick={() =>
                              updateItem(globalIdx, { status: "OK" })
                            }
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              item.status === "Defective" ? "default" : "outline"
                            }
                            className={
                              item.status === "Defective"
                                ? "bg-amber-600 hover:bg-amber-700 h-8 px-2"
                                : "h-8 px-2"
                            }
                            onClick={() =>
                              updateItem(globalIdx, { status: "Defective" })
                            }
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              item.status === "Missing" ? "default" : "outline"
                            }
                            className={
                              item.status === "Missing"
                                ? "bg-red-600 hover:bg-red-700 h-8 px-2"
                                : "h-8 px-2"
                            }
                            onClick={() =>
                              updateItem(globalIdx, { status: "Missing" })
                            }
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

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
                            className="text-sm"
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

        <DialogFooter className="flex items-center justify-between">
          <div>
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
              className="bg-red-600 hover:bg-red-700"
            >
              {submitMutation.isPending ? "Submitting..." : "Complete J4 Check"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
