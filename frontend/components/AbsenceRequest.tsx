import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import type { AbsenceType } from "~backend/absence/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Send, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";

export default function AbsenceRequest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    type: "sickness" as AbsenceType,
    start_date: "",
    end_date: "",
    reason: "",
  });

  const createAbsenceMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      
      return await backend.absence.create({
        user_id: user.id,
        absence_type: formData.type,
        start_date: new Date(formData.start_date),
        end_date: new Date(formData.end_date),
        reason: formData.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-absences", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-absence-stats", user?.id] });
      toast({
        title: "Absence request submitted",
        description: "Your request has been sent to your supervisor for approval",
      });
      setFormData({
        type: "sickness",
        start_date: "",
        end_date: "",
        reason: "",
      });
    },
    onError: (error) => {
      console.error("Failed to create absence request:", error);
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Failed to submit absence request",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.start_date || !formData.end_date || !formData.reason) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);

    if (endDate < startDate) {
      toast({
        title: "Invalid dates",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    createAbsenceMutation.mutate();
  };

  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0;
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : 0;
  };

  const days = calculateDays();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Request Absence</h2>
        <p className="text-muted-foreground mt-1">
          Submit a new absence request for approval
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Absence Details
            </CardTitle>
            <CardDescription>
              All requests are sent to your Crew Commander or Watch Commander for approval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: AbsenceType) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger id="type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sickness">Sickness</SelectItem>
                  <SelectItem value="AL">Annual Leave (AL)</SelectItem>
                  <SelectItem value="TOIL">Time Off In Lieu (TOIL)</SelectItem>
                  <SelectItem value="parental">Parental Leave</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="end_date">End Date *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
            </div>

            {days > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                      Total duration: {days} day{days === 1 ? "" : "s"}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      {formData.start_date && formData.end_date && (
                        <>
                          From {new Date(formData.start_date).toLocaleDateString()} to{" "}
                          {new Date(formData.end_date).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Provide details about your absence..."
                className="mt-1"
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground mt-2">
                For sickness absences, please include symptoms or diagnosis. For leave requests, provide any relevant details.
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    Approval Process
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Your request will be reviewed by your line manager (CC/WC). You'll receive notification once it's been reviewed.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={createAbsenceMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {createAbsenceMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFormData({
                    type: "sickness",
                    start_date: "",
                    end_date: "",
                    reason: "",
                  })
                }
                disabled={createAbsenceMutation.isPending}
              >
                Clear Form
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
