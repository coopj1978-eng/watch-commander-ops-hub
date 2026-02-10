import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Clock,
  ShieldAlert,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIsCrewCommander } from "@/lib/rbac";
import backend from "@/lib/backend";

export default function DefectsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isCC = useIsCrewCommander();
  const [filterStatus, setFilterStatus] = useState<string>("Open");

  const { data: defectsData, isLoading } = useQuery({
    queryKey: ["defects", filterStatus === "all" ? undefined : filterStatus],
    queryFn: async () => {
      const params: any = {};
      if (filterStatus !== "all") params.status = filterStatus;
      const result = await backend.appliance.listDefects(params);
      return result;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: string;
    }) => {
      return await backend.appliance.updateDefect({ id, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      toast({ title: "Defect updated" });
    },
    onError: () => {
      toast({ title: "Failed to update defect", variant: "destructive" });
    },
  });

  const defects = defectsData?.defects || [];

  const statusIcon = (status: string) => {
    switch (status) {
      case "Open":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "Ordered":
        return <Package className="h-4 w-4 text-blue-600" />;
      case "Resolved":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400";
      case "Ordered":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400";
      case "Resolved":
        return "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Ordered">Ordered</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">
          Loading defects...
        </p>
      ) : defects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-600" />
          <p className="text-lg">
            {filterStatus === "Open"
              ? "No open defects. All equipment is operational."
              : "No defects matching this filter."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead>Appliance</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reported By</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Status</TableHead>
                {isCC && <TableHead className="w-[120px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {defects.map((defect) => {
                const daysOpen =
                  defect.status !== "Resolved"
                    ? differenceInDays(new Date(), new Date(defect.reported_at))
                    : null;

                return (
                  <TableRow key={defect.id}>
                    <TableCell className="font-medium">
                      {defect.equipment_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {defect.appliance_call_sign}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px] text-sm">
                      {defect.description}
                    </TableCell>
                    <TableCell className="text-sm">
                      {defect.reported_by_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {format(
                            new Date(defect.reported_at),
                            "dd MMM yyyy"
                          )}
                        </span>
                        {defect.overdue && (
                          <Badge
                            variant="destructive"
                            className="text-xs flex items-center gap-1"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            {daysOpen}d — Reorder
                          </Badge>
                        )}
                        {!defect.overdue && daysOpen !== null && daysOpen > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({daysOpen}d ago)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor(defect.status)}>
                        <span className="flex items-center gap-1">
                          {statusIcon(defect.status)}
                          {defect.status}
                        </span>
                      </Badge>
                    </TableCell>
                    {isCC && (
                      <TableCell>
                        {defect.status === "Open" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                updateMutation.mutate({
                                  id: defect.id,
                                  status: "Ordered",
                                })
                              }
                            >
                              <Package className="h-3 w-3 mr-1" />
                              Ordered
                            </Button>
                          </div>
                        )}
                        {defect.status === "Ordered" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              updateMutation.mutate({
                                id: defect.id,
                                status: "Resolved",
                              })
                            }
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Resolved
                          </Button>
                        )}
                        {defect.status === "Resolved" && (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
