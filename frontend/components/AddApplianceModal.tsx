import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import backend from "@/lib/backend";

interface AddApplianceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddApplianceModal({
  open,
  onOpenChange,
}: AddApplianceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    call_sign: "",
    name: "",
    type: "Rescue" as string,
    station_call_sign: "B10",
    station_name: "Springburn",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await backend.appliance.createAppliance(formData as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appliances"] });
      toast({ title: "Appliance added", description: `${formData.call_sign} has been added.` });
      setFormData({
        call_sign: "",
        name: "",
        type: "Rescue",
        station_call_sign: "B10",
        station_name: "Springburn",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to add appliance", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Add Appliance
          </DialogTitle>
          <DialogDescription>
            Add a new appliance to the station.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="call_sign">Call Sign *</Label>
            <Input
              id="call_sign"
              placeholder="e.g. B10P3"
              value={formData.call_sign}
              onChange={(e) =>
                setFormData((p) => ({ ...p, call_sign: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Command Unit"
              value={formData.name}
              onChange={(e) =>
                setFormData((p) => ({ ...p, name: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="type">Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, type: v }))
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Rescue">Rescue</SelectItem>
                <SelectItem value="Decon">Decontamination</SelectItem>
                <SelectItem value="Aerial">Aerial</SelectItem>
                <SelectItem value="Special">Special</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="station_call_sign">Station Call Sign</Label>
              <Input
                id="station_call_sign"
                value={formData.station_call_sign}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    station_call_sign: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="station_name">Station Name</Label>
              <Input
                id="station_name"
                value={formData.station_name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, station_name: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              !formData.call_sign.trim() ||
              !formData.name.trim() ||
              createMutation.isPending
            }
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {createMutation.isPending ? "Adding..." : "Add Appliance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
