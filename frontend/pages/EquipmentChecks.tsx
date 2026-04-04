import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  ClipboardCheck,
  AlertTriangle,
  History,
  Plus,
  Settings2,
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

export default function EquipmentChecks() {
  const isWC = useIsWatchCommander();
  const isCC = useIsCrewCommander();
  const [activeTab, setActiveTab] = useState("appliances");
  const [selectedApplianceId, setSelectedApplianceId] = useState<number | null>(null);
  const [checkFormOpen, setCheckFormOpen] = useState(false);
  const [manageEquipmentOpen, setManageEquipmentOpen] = useState(false);
  const [addApplianceOpen, setAddApplianceOpen] = useState(false);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Truck className="h-8 w-8 text-red-600" />
            J4 Equipment Checks
          </h1>
          <p className="text-muted-foreground mt-1">
            B10 Springburn — Appliance & Equipment Management
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {overdueDefects.length > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {overdueDefects.length} overdue defect{overdueDefects.length !== 1 ? "s" : ""} (30+ days)
            </Badge>
          )}
          {isWC && (
            <Button onClick={() => setAddApplianceOpen(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Appliance
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
    </div>
  );
}
