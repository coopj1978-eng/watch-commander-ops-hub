import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  ClipboardCheck,
  Settings2,
  Shield,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import backend from "@/lib/backend";
import { format } from "date-fns";

interface ApplianceCardProps {
  appliance: {
    id: number;
    call_sign: string;
    name: string;
    type: string;
  };
  onStartCheck: () => void;
  onManageEquipment: () => void;
  canManage: boolean;
}

export default function ApplianceCard({
  appliance,
  onStartCheck,
  onManageEquipment,
  canManage,
}: ApplianceCardProps) {
  const { data: equipmentData } = useQuery({
    queryKey: ["equipment", appliance.id],
    queryFn: async () => {
      const result = await backend.appliance.listEquipment({
        appliance_id: appliance.id,
      });
      return result;
    },
  });

  const { data: checksData } = useQuery({
    queryKey: ["checks", appliance.id, "latest"],
    queryFn: async () => {
      const result = await backend.appliance.listChecks({
        appliance_id: appliance.id,
        limit: 1,
      });
      return result;
    },
  });

  const { data: defectsData } = useQuery({
    queryKey: ["defects", appliance.id, "open"],
    queryFn: async () => {
      const result = await backend.appliance.listDefects({
        appliance_id: appliance.id,
        status: "Open",
      });
      return result;
    },
  });

  const equipmentCount = equipmentData?.items?.length || 0;
  const latestCheck = checksData?.checks?.[0];
  const openDefects = defectsData?.defects?.length || 0;

  const typeIcon = appliance.type === "Decon" ? Shield : Truck;
  const TypeIcon = typeIcon;

  const typeColor =
    appliance.type === "Rescue"
      ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
      : appliance.type === "Decon"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
      : "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400";

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${typeColor}`}>
              <TypeIcon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">{appliance.call_sign}</CardTitle>
              <CardDescription>{appliance.name}</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={typeColor}>
            {appliance.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Equipment count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Equipment Items</span>
          <span className="font-medium">{equipmentCount}</span>
        </div>

        {/* Last check info */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last J4 Check</span>
          {latestCheck ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              {format(new Date(latestCheck.started_at), "dd MMM yyyy HH:mm")}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-600">
              <Clock className="h-3.5 w-3.5" />
              No checks yet
            </span>
          )}
        </div>

        {/* Watch info */}
        {latestCheck && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Watch</span>
            <Badge variant="secondary" className="text-xs">
              {latestCheck.watch} Shift
            </Badge>
          </div>
        )}

        {/* Open defects */}
        {openDefects > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Open Defects</span>
            <Badge variant="destructive" className="text-xs">
              {openDefects}
            </Badge>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 pt-3 border-t">
        <Button
          onClick={onStartCheck}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700"
          size="sm"
        >
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Start J4 Check
        </Button>
        {canManage && (
          <Button
            onClick={onManageEquipment}
            variant="outline"
            size="sm"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
