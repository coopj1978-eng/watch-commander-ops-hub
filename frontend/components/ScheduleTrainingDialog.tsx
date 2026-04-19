import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { GraduationCap, Loader2 } from "lucide-react";

// Shared lookup tables — kept in sync with Training page.
export const TRAINING_TYPE_LABELS: Record<string, string> = {
  ba_drill: "BA Drill",
  rtc: "RTC / Extrication",
  ladder: "Ladder Drill",
  water: "Water / Rescue",
  hazmat: "HAZMAT",
  first_aid: "First Aid",
  driver: "Driver Training",
  debrief: "Debrief",
  physical: "Physical Training",
  station_drill: "Station Drill",
  lecture: "Lecture / Theory",
  assessment: "Assessment",
  other: "Other",
};

const SHIFT_TYPES = [
  { value: "1st Day", label: "1st Day" },
  { value: "2nd Day", label: "2nd Day" },
  { value: "1st Night", label: "1st Night" },
  { value: "2nd Night", label: "2nd Night" },
];

interface ScheduleForm {
  training_date: string;
  training_type: string;
  topic: string;
  shift_type: string;
}

function emptyForm(defaultDate?: string): ScheduleForm {
  return {
    training_date: defaultDate ?? new Date().toISOString().split("T")[0],
    training_type: "",
    topic: "",
    shift_type: "",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Watch the training will be scheduled under. */
  watch: string;
  /** Optional date to pre-fill (YYYY-MM-DD). */
  defaultDate?: string;
  /** Called after a successful schedule so the parent can react (e.g. refresh). */
  onScheduled?: () => void;
}

export default function ScheduleTrainingDialog({
  open,
  onOpenChange,
  watch,
  defaultDate,
  onScheduled,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ScheduleForm>(emptyForm(defaultDate));

  // Reset form whenever the dialog opens so each scheduling starts clean.
  useEffect(() => {
    if (open) setForm(emptyForm(defaultDate));
  }, [open, defaultDate]);

  const createMutation = useMutation({
    mutationFn: (data: ScheduleForm) =>
      backend.training.create({
        watch,
        training_date: data.training_date,
        training_type: data.training_type,
        topic: data.topic,
        shift_type: data.shift_type || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Training scheduled", description: "Added to the watch calendar." });
      // Invalidate both training lists and calendar queries so the new event
      // appears everywhere without a page reload.
      queryClient.invalidateQueries({ queryKey: ["training"] });
      queryClient.invalidateQueries({ queryKey: ["cal-watch"] });
      queryClient.invalidateQueries({ queryKey: ["cal-station"] });
      onOpenChange(false);
      onScheduled?.();
    },
    onError: (e: any) => {
      toast({
        title: "Could not schedule",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const valid =
    !!watch && !!form.training_date && !!form.training_type && !!form.topic;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-teal-500" />
            Schedule Training
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Training Date *</Label>
              <Input
                type="date"
                value={form.training_date}
                onChange={(e) => setForm((f) => ({ ...f, training_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Shift (optional)</Label>
              <Select
                value={form.shift_type}
                onValueChange={(v) => setForm((f) => ({ ...f, shift_type: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Any shift" /></SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Training Type *</Label>
            <Select
              value={form.training_type}
              onValueChange={(v) => setForm((f) => ({ ...f, training_type: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {Object.entries(TRAINING_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Topic *</Label>
            <Input
              placeholder="e.g. Pump to open water"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            />
          </div>

          {!watch && (
            <p className="text-xs text-amber-600">
              You need a watch assigned before you can schedule training.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              disabled={!valid || createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
            >
              {createMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                "Schedule"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
