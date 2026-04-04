import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import type { Inspection, InspectionType, InspectionStatus, InspectionPriority } from "~backend/inspection/types";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { X, Upload, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface InspectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection?: Inspection;
  mode: "create" | "edit" | "view";
}

export default function InspectionForm({ open, onOpenChange, inspection, mode }: InspectionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<{
    type: InspectionType;
    address: string;
    priority: InspectionPriority;
    scheduled_for: string;
    assigned_crew_ids: string[];
    status: InspectionStatus;
    notes: string;
    completed_date: string;
  }>({
    type: inspection?.type || "LocalProperty",
    address: inspection?.address || "",
    priority: inspection?.priority || "Med",
    scheduled_for: inspection?.scheduled_for
      ? new Date(inspection.scheduled_for).toISOString().split("T")[0]
      : "",
    assigned_crew_ids: inspection?.assigned_crew_ids || [],
    status: inspection?.status || "Planned",
    notes: inspection?.notes || "",
    completed_date: inspection?.completed_date
      ? new Date(inspection.completed_date).toISOString().split("T")[0]
      : "",
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const result = await backend.user.list({ limit: 200 });
      return result.users;
    },
  });

  const users = usersData || [];
  const crewMembers = users.filter((u) => ["FF", "CC"].includes(u.role));

  const createMutation = useMutation({
    mutationFn: async () => {
      return await backend.inspection.create({
        type: formData.type,
        address: formData.address,
        priority: formData.priority,
        scheduled_for: formData.scheduled_for,
        assigned_crew_ids: formData.assigned_crew_ids,
        status: formData.status,
        notes: formData.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      toast({
        title: "Inspection created",
        description: "The inspection has been created successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to create inspection:", error);
      toast({
        title: "Failed to create inspection",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!inspection) throw new Error("No inspection to update");
      return await backend.inspection.update(inspection.id, {
        type: formData.type,
        address: formData.address,
        priority: formData.priority,
        scheduled_for: formData.scheduled_for,
        assigned_crew_ids: formData.assigned_crew_ids,
        status: formData.status,
        notes: formData.notes,
        completed_date: formData.completed_date || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      toast({
        title: "Inspection updated",
        description: "The inspection has been updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to update inspection:", error);
      toast({
        title: "Failed to update inspection",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!formData.address || !formData.scheduled_for) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (mode === "create") {
      createMutation.mutate();
    } else if (mode === "edit") {
      updateMutation.mutate();
    }
  };

  const toggleCrewMember = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      assigned_crew_ids: prev.assigned_crew_ids.includes(userId)
        ? prev.assigned_crew_ids.filter((id) => id !== userId)
        : [...prev.assigned_crew_ids, userId],
    }));
  };

  const isReadOnly = mode === "view";
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Inspection" : mode === "edit" ? "Edit Inspection" : "Inspection Details"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new inspection to the schedule"
              : mode === "edit"
              ? "Update inspection details"
              : "View inspection information"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: InspectionType) =>
                  setFormData({ ...formData, type: value })
                }
                disabled={isReadOnly}
              >
                <SelectTrigger id="type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HighRise">High Rise</SelectItem>
                  <SelectItem value="LocalProperty">Local Property</SelectItem>
                  <SelectItem value="Hydrant">Hydrant</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: InspectionPriority) =>
                  setFormData({ ...formData, priority: value })
                }
                disabled={isReadOnly}
              >
                <SelectTrigger id="priority" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Med">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main Street, City"
              disabled={isReadOnly}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="scheduled_for">Scheduled Date *</Label>
              <Input
                id="scheduled_for"
                type="date"
                value={formData.scheduled_for}
                onChange={(e) => setFormData({ ...formData, scheduled_for: e.target.value })}
                disabled={isReadOnly}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: InspectionStatus) =>
                  setFormData({ ...formData, status: value })
                }
                disabled={isReadOnly}
              >
                <SelectTrigger id="status" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="InProgress">In Progress</SelectItem>
                  <SelectItem value="Complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.status === "Complete" && (
            <div>
              <Label htmlFor="completed_date">Completed Date</Label>
              <Input
                id="completed_date"
                type="date"
                value={formData.completed_date}
                onChange={(e) => setFormData({ ...formData, completed_date: e.target.value })}
                disabled={isReadOnly}
                className="mt-1"
              />
            </div>
          )}

          <div>
            <Label>Assigned Crew ({formData.assigned_crew_ids.length} selected)</Label>
            <div className="mt-2 border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
              {crewMembers.length > 0 ? (
                crewMembers.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`crew-${user.id}`}
                      checked={formData.assigned_crew_ids.includes(user.id)}
                      onCheckedChange={() => toggleCrewMember(user.id)}
                      disabled={isReadOnly}
                    />
                    <label
                      htmlFor={`crew-${user.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                    >
                      {user.name}
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No crew members available</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any relevant notes or observations..."
              disabled={isReadOnly}
              className="mt-1"
              rows={4}
            />
          </div>

          {!isReadOnly && (
            <div>
              <Label>Attachments</Label>
              <div className="mt-2 border-2 border-dashed rounded-md p-6 text-center hover:border-indigo-500/50 transition-colors cursor-pointer">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Upload inspection documents
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Photos, reports, PDFs - Max 10MB each
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={(e) => {
                    e.preventDefault();
                    toast({
                      title: "Feature coming soon",
                      description: "File attachments will be implemented using Encore.ts Object Storage",
                    });
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Select files
                </Button>
              </div>
            </div>
          )}

          {isReadOnly && inspection && (
            <div>
              <Label>Attachments</Label>
              <div className="mt-2 border rounded-md p-4 text-center text-sm text-muted-foreground">
                No attachments uploaded
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isReadOnly ? "Close" : "Cancel"}
          </Button>
          {!isReadOnly && (
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isPending ? "Saving..." : mode === "create" ? "Create Inspection" : "Save Changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
