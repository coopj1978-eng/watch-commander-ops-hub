import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useIsWC } from "@/lib/rbac";
import { Loader2, AlertTriangle, Lock } from "lucide-react";

export function AbsenceThresholds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isWC = useIsWC();

  const [thresholdDays, setThresholdDays] = useState<number>(10);
  const [periodMonths, setPeriodMonths] = useState<number>(6);
  
  const [stage1Episodes, setStage1Episodes] = useState<number>(2);
  const [stage1Days, setStage1Days] = useState<number>(5);
  const [stage2Episodes, setStage2Episodes] = useState<number>(3);
  const [stage2Days, setStage2Days] = useState<number>(10);
  const [stage3Episodes, setStage3Episodes] = useState<number>(4);
  const [stage3Days, setStage3Days] = useState<number>(15);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => backend.settings.get(),
  });

  useEffect(() => {
    if (settings) {
      setThresholdDays(settings.absence_threshold_days);
      setPeriodMonths(settings.absence_threshold_period_months);
      setStage1Episodes(settings.trigger_stage1_episodes);
      setStage1Days(settings.trigger_stage1_days);
      setStage2Episodes(settings.trigger_stage2_episodes);
      setStage2Days(settings.trigger_stage2_days);
      setStage3Episodes(settings.trigger_stage3_episodes);
      setStage3Days(settings.trigger_stage3_days);
    }
  }, [settings]);

  const updateAbsenceMutation = useMutation({
    mutationFn: async () => {
      return await backend.settings.updateAbsenceThresholds({
        absence_threshold_days: thresholdDays,
        absence_threshold_period_months: periodMonths,
      });
    },
    onSuccess: () => {
      toast({
        title: "Thresholds updated",
        description: "Absence trigger thresholds have been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (error: any) => {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update thresholds",
        variant: "destructive",
      });
    },
  });

  const updateTriggerMutation = useMutation({
    mutationFn: async () => {
      return await backend.settings.updateTriggerThresholds({
        trigger_stage1_episodes: stage1Episodes,
        trigger_stage1_days: stage1Days,
        trigger_stage2_episodes: stage2Episodes,
        trigger_stage2_days: stage2Days,
        trigger_stage3_episodes: stage3Episodes,
        trigger_stage3_days: stage3Days,
      });
    },
    onSuccess: () => {
      toast({
        title: "Trigger stages updated",
        description: "Sickness trigger stages have been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (error: any) => {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update trigger stages",
        variant: "destructive",
      });
    },
  });

  const handleSaveAbsence = () => {
    if (thresholdDays < 1 || periodMonths < 1) {
      toast({
        title: "Invalid values",
        description: "Days and months must be at least 1",
        variant: "destructive",
      });
      return;
    }
    updateAbsenceMutation.mutate();
  };

  const handleSaveTriggers = () => {
    if (
      stage1Episodes < 1 || stage1Days < 1 ||
      stage2Episodes < 1 || stage2Days < 1 ||
      stage3Episodes < 1 || stage3Days < 1
    ) {
      toast({
        title: "Invalid values",
        description: "All values must be at least 1",
        variant: "destructive",
      });
      return;
    }
    updateTriggerMutation.mutate();
  };

  const hasAbsenceChanges = settings && (
    thresholdDays !== settings.absence_threshold_days ||
    periodMonths !== settings.absence_threshold_period_months
  );

  const hasTriggerChanges = settings && (
    stage1Episodes !== settings.trigger_stage1_episodes ||
    stage1Days !== settings.trigger_stage1_days ||
    stage2Episodes !== settings.trigger_stage2_episodes ||
    stage2Days !== settings.trigger_stage2_days ||
    stage3Episodes !== settings.trigger_stage3_episodes ||
    stage3Days !== settings.trigger_stage3_days
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Absence Thresholds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Absence Trigger Thresholds
          </CardTitle>
          <CardDescription>
            Configure when to flag excessive absences (rolling period)
          </CardDescription>
          {!isWC && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Read-only (Watch Commander access required)</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="threshold-days">Threshold (Days)</Label>
              <Input
                id="threshold-days"
                type="number"
                min="1"
                value={thresholdDays}
                onChange={(e) => setThresholdDays(parseInt(e.target.value) || 0)}
                disabled={!isWC}
              />
              <p className="text-xs text-muted-foreground">
                Trigger alert when absences exceed this many days
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="period-months">Rolling Period (Months)</Label>
              <Input
                id="period-months"
                type="number"
                min="1"
                value={periodMonths}
                onChange={(e) => setPeriodMonths(parseInt(e.target.value) || 0)}
                disabled={!isWC}
              />
              <p className="text-xs text-muted-foreground">
                Calculate absences over this rolling period
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-1">Current Configuration</p>
            <p className="text-sm text-muted-foreground">
              Alert will trigger when a firefighter has <strong>{thresholdDays} days</strong> or more 
              of absence within a rolling <strong>{periodMonths}-month</strong> period
            </p>
          </div>

          {isWC && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (settings) {
                    setThresholdDays(settings.absence_threshold_days);
                    setPeriodMonths(settings.absence_threshold_period_months);
                  }
                }}
                disabled={!hasAbsenceChanges || updateAbsenceMutation.isPending}
              >
                Reset
              </Button>
              <Button
                onClick={handleSaveAbsence}
                disabled={!hasAbsenceChanges || updateAbsenceMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {updateAbsenceMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Sickness Trigger Stages (6-Month Rolling)
          </CardTitle>
          <CardDescription>
            Configure trigger stages based on sickness episodes and days
          </CardDescription>
          {!isWC && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Read-only (Watch Commander access required)</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-semibold mb-3 text-blue-600 dark:text-blue-400">Stage 1</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stage1-episodes">Episodes</Label>
                  <Input
                    id="stage1-episodes"
                    type="number"
                    min="1"
                    value={stage1Episodes}
                    onChange={(e) => setStage1Episodes(parseInt(e.target.value) || 0)}
                    disabled={!isWC}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage1-days">Days</Label>
                  <Input
                    id="stage1-days"
                    type="number"
                    min="1"
                    value={stage1Days}
                    onChange={(e) => setStage1Days(parseInt(e.target.value) || 0)}
                    disabled={!isWC}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Triggers when episodes ≥ {stage1Episodes} OR days ≥ {stage1Days}
              </p>
            </div>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <h4 className="font-semibold mb-3 text-yellow-600 dark:text-yellow-400">Stage 2</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stage2-episodes">Episodes</Label>
                  <Input
                    id="stage2-episodes"
                    type="number"
                    min="1"
                    value={stage2Episodes}
                    onChange={(e) => setStage2Episodes(parseInt(e.target.value) || 0)}
                    disabled={!isWC}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage2-days">Days</Label>
                  <Input
                    id="stage2-days"
                    type="number"
                    min="1"
                    value={stage2Days}
                    onChange={(e) => setStage2Days(parseInt(e.target.value) || 0)}
                    disabled={!isWC}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Triggers when episodes ≥ {stage2Episodes} OR days ≥ {stage2Days}
              </p>
            </div>

            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <h4 className="font-semibold mb-3 text-red-600 dark:text-red-400">Stage 3</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stage3-episodes">Episodes</Label>
                  <Input
                    id="stage3-episodes"
                    type="number"
                    min="1"
                    value={stage3Episodes}
                    onChange={(e) => setStage3Episodes(parseInt(e.target.value) || 0)}
                    disabled={!isWC}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage3-days">Days</Label>
                  <Input
                    id="stage3-days"
                    type="number"
                    min="1"
                    value={stage3Days}
                    onChange={(e) => setStage3Days(parseInt(e.target.value) || 0)}
                    disabled={!isWC}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Triggers when episodes ≥ {stage3Episodes} OR days ≥ {stage3Days}
              </p>
            </div>
          </div>

          {isWC && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (settings) {
                    setStage1Episodes(settings.trigger_stage1_episodes);
                    setStage1Days(settings.trigger_stage1_days);
                    setStage2Episodes(settings.trigger_stage2_episodes);
                    setStage2Days(settings.trigger_stage2_days);
                    setStage3Episodes(settings.trigger_stage3_episodes);
                    setStage3Days(settings.trigger_stage3_days);
                  }
                }}
                disabled={!hasTriggerChanges || updateTriggerMutation.isPending}
              >
                Reset
              </Button>
              <Button
                onClick={handleSaveTriggers}
                disabled={!hasTriggerChanges || updateTriggerMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {updateTriggerMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
