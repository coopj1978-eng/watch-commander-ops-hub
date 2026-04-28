import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  ClipboardCheck,
  AlertTriangle,
  History,
  Plus,
  Settings2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import backend from "@/lib/backend";
import { useIsWatchCommander, useIsCrewCommander } from "@/lib/rbac";
import ApplianceCard from "@/components/ApplianceCard";
import CheckForm from "@/components/CheckForm";
import CheckHistory from "@/components/CheckHistory";
import DefectsList from "@/components/DefectsList";
import EquipmentManager from "@/components/EquipmentManager";
import AddApplianceModal from "@/components/AddApplianceModal";
import ReportDefectDialog from "@/components/ReportDefectDialog";

export default function EquipmentChecks() {
  const isWC = useIsWatchCommander();
  const isCC = useIsCrewCommander();
  const [activeTab, setActiveTab] = useState("appliances");
  const [selectedApplianceId, setSelectedApplianceId] = useState<number | null>(null);
  const [checkFormOpen, setCheckFormOpen] = useState(false);
  const [manageEquipmentOpen, setManageEquipmentOpen] = useState(false);
  const [addApplianceOpen, setAddApplianceOpen] = useState(false);
  const [reportDefectOpen, setReportDefectOpen] = useState(false);

  const { data: appliancesData, isLoading } = useQuery({
    queryKey: ["appliances"],
    queryFn: async () => {
      const result = await backend.appliance.listAppliances({});
      return result;
    },
  });

  const { data: defectsData } = useQuery({
    queryKey: ["defects", "Open"],
    queryFn: async () => {
      const result = await backend.appliance.listDefects({ status: "Open" });
      return result;
    },
  });

  const appliances = appliancesData?.appliances || [];
  const openDefects = defectsData?.defects || [];
  const overdueDefects = openDefects.filter((d) => d.overdue);

  const handleStartCheck = (applianceId: number) => {
    setSelectedApplianceId(applianceId);
    setCheckFormOpen(true);
  };

  const handleManageEquipment = (applianceId: number) => {
    setSelectedApplianceId(applianceId);
    setManageEquipmentOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Visual-refresh page header: h1 + eyebrow + action buttons. */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
        <div className="flex items-baseline flex-wrap gap-x-4 gap-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Truck className="h-7 w-7 text-brand shrink-0" />
            J4 Equipment Checks
          </h1>
          <span className="eyebrow whitespace-nowrap">
            B10 Springburn
            <span className="crumb-sep">·</span>
            Appliance & Equipment Management
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {overdueDefects.length > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {overdueDefects.length} overdue defect{overdueDefects.length !== 1 ? "s" : ""} (30+ days)
            </Badge>
          )}
          <Button
            onClick={() => setReportDefectOpen(true)}
            variant="outline"
            className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/20"
            aria-label="Report Defect"
          >
            <Wrench className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Report Defect</span>
          </Button>
          {isWC && (
            <Button onClick={() => setAddApplianceOpen(true)} variant="outline" aria-label="Add Appliance">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Appliance</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="appliances" className="gap-2">
            <Truck className="h-4 w-4" />
            Appliances
          </TabsTrigger>
          <TabsTrigger value="defects" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Defects
            {openDefects.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {openDefects.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Check History
          </TabsTrigger>
        </TabsList>

        {/* Appliances Tab */}
        <TabsContent value="appliances" className="mt-6">
          {appliances.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Truck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium text-foreground">No appliances configured yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isWC
                    ? "Click \"Add Appliance\" to register your first appliance."
                    : "No appliances have been registered yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {appliances.map((appliance) => (
                <ApplianceCard
                  key={appliance.id}
                  appliance={appliance}
                  onStartCheck={() => handleStartCheck(appliance.id)}
                  onManageEquipment={() => handleManageEquipment(appliance.id)}
                  canManage={isCC}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Defects Tab */}
        <TabsContent value="defects" className="mt-6">
          <DefectsList />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <CheckHistory appliances={appliances} />
        </TabsContent>
      </Tabs>

      {/* Check Form Modal */}
      {selectedApplianceId && (
        <CheckForm
          open={checkFormOpen}
          onOpenChange={setCheckFormOpen}
          applianceId={selectedApplianceId}
          applianceName={appliances.find((a) => a.id === selectedApplianceId)?.call_sign || ""}
        />
      )}

      {/* Equipment Manager Modal */}
      {selectedApplianceId && (
        <EquipmentManager
          open={manageEquipmentOpen}
          onOpenChange={setManageEquipmentOpen}
          applianceId={selectedApplianceId}
          applianceName={appliances.find((a) => a.id === selectedApplianceId)?.call_sign || ""}
        />
      )}

      {/* Add Appliance Modal */}
      <AddApplianceModal
        open={addApplianceOpen}
        onOpenChange={setAddApplianceOpen}
      />

      {/* Report Defect Modal — standalone (not tied to a J4 check) */}
      <ReportDefectDialog
        open={reportDefectOpen}
        onOpenChange={setReportDefectOpen}
        onReported={() => setActiveTab("defects")}
      />
    </div>
  );
}
