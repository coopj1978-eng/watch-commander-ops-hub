import { useState, useEffect } from "react";
import backend from "@/lib/backend";
import type { User } from "~backend/user/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, ChevronRight, ChevronLeft } from "lucide-react";

interface OffboardingWizardProps {
  user: User;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface ReassignmentPreview {
  taskCount: number;
  inspectionCount: number;
  absenceCount: number;
}

export function OffboardingWizard({ user, open, onClose, onComplete }: OffboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [deactivationDate, setDeactivationDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState("");
  const [replacementUserId, setReplacementUserId] = useState("");
  const [reassignTasks, setReassignTasks] = useState(true);
  const [reassignInspections, setReassignInspections] = useState(true);
  const [reassignAbsences, setReassignAbsences] = useState(true);
  const [preview, setPreview] = useState<ReassignmentPreview | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadActiveUsers();
      loadPreview();
    }
  }, [open, user.id]);

  const loadActiveUsers = async () => {
    try {
      const { users } = await backend.admin.listUsers();
      setActiveUsers(users.filter((u) => u.is_active && u.id !== user.id) as unknown as User[]);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const loadPreview = async () => {
    try {
      const previewData = await backend.admin.getReassignmentPreview(user.id);
      setPreview(previewData);
    } catch (error) {
      console.error("Failed to load preview:", error);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!replacementUserId && (reassignTasks || reassignInspections || reassignAbsences)) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please select a replacement user for reassignment",
        });
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (replacementUserId && (reassignTasks || reassignInspections || reassignAbsences)) {
        await backend.admin.reassignAssets({
          userId: user.id,
          replacementUserId,
          assets: {
            tasks: reassignTasks,
            inspections: reassignInspections,
            absences: reassignAbsences,
          },
        });
      }

      await backend.admin.deactivateUser(user.id, {
        deactivationDate: deactivationDate,
        reason: reason || undefined,
      });

      toast({
        title: "Success",
        description: `${user.name} has been deactivated successfully`,
      });

      onComplete();
    } catch (error) {
      console.error("Failed to deactivate user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to deactivate user",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasAssetsToReassign = 
    (preview?.taskCount ?? 0) > 0 || 
    (preview?.inspectionCount ?? 0) > 0 || 
    (preview?.absenceCount ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Offboarding: {user.name}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="deactivationDate">Deactivation Date</Label>
              <Input
                id="deactivationDate"
                type="date"
                value={deactivationDate}
                onChange={(e) => setDeactivationDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="E.g., Resignation, Retirement, Transfer..."
                className="mt-1"
                rows={3}
              />
            </div>

            {hasAssetsToReassign && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Assets requiring reassignment:</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {(preview?.taskCount ?? 0) > 0 && (
                      <li>• {preview?.taskCount} open task(s)</li>
                    )}
                    {(preview?.inspectionCount ?? 0) > 0 && (
                      <li>• {preview?.inspectionCount} assigned inspection(s)</li>
                    )}
                    {(preview?.absenceCount ?? 0) > 0 && (
                      <li>• {preview?.absenceCount} pending approval(s)</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a replacement user and choose which assets to reassign:
            </p>

            <div>
              <Label htmlFor="replacement">Replacement User</Label>
              <Select value={replacementUserId} onValueChange={setReplacementUserId}>
                <SelectTrigger id="replacement" className="mt-1">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2">
              {(preview?.taskCount ?? 0) > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="reassign-tasks"
                    checked={reassignTasks}
                    onCheckedChange={(checked) => setReassignTasks(checked === true)}
                  />
                  <Label htmlFor="reassign-tasks" className="cursor-pointer">
                    Reassign {preview?.taskCount} open task(s)
                  </Label>
                </div>
              )}

              {(preview?.inspectionCount ?? 0) > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="reassign-inspections"
                    checked={reassignInspections}
                    onCheckedChange={(checked) => setReassignInspections(checked === true)}
                  />
                  <Label htmlFor="reassign-inspections" className="cursor-pointer">
                    Reassign {preview?.inspectionCount} assigned inspection(s)
                  </Label>
                </div>
              )}

              {(preview?.absenceCount ?? 0) > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="reassign-absences"
                    checked={reassignAbsences}
                    onCheckedChange={(checked) => setReassignAbsences(checked === true)}
                  />
                  <Label htmlFor="reassign-absences" className="cursor-pointer">
                    Reassign {preview?.absenceCount} pending approval(s)
                  </Label>
                </div>
              )}
            </div>

            {!hasAssetsToReassign && (
              <p className="text-sm text-muted-foreground italic">
                No assets require reassignment for this user.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please review the offboarding details before confirming:
            </p>

            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User:</span>
                <span className="font-medium">{user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deactivation Date:</span>
                <span className="font-medium">
                  {new Date(deactivationDate).toLocaleDateString()}
                </span>
              </div>
              {reason && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reason:</span>
                  <span className="font-medium">{reason}</span>
                </div>
              )}
              {replacementUserId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Replacement:</span>
                  <span className="font-medium">
                    {activeUsers.find((u) => u.id === replacementUserId)?.name}
                  </span>
                </div>
              )}
              {hasAssetsToReassign && (
                <div className="pt-2 border-t border-border">
                  <p className="text-muted-foreground mb-1">Assets to reassign:</p>
                  <ul className="space-y-1 ml-4">
                    {reassignTasks && <li>✓ Tasks</li>}
                    {reassignInspections && <li>✓ Inspections</li>}
                    {reassignAbsences && <li>✓ Absence Approvals</li>}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <p className="text-sm">
                This action will deactivate the user account and prevent them from signing in.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
                {loading ? "Processing..." : "Confirm Deactivation"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
