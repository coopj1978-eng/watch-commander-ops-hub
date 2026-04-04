import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Clock,
  User,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import backend from "@/lib/backend";

interface CheckHistoryProps {
  appliances: { id: number; call_sign: string; name: string }[];
}

export default function CheckHistory({ appliances }: CheckHistoryProps) {
  const [filterAppliance, setFilterAppliance] = useState<string>("all");
  const [filterWatch, setFilterWatch] = useState<string>("all");
  const [selectedCheckId, setSelectedCheckId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const applianceId =
    filterAppliance !== "all" ? parseInt(filterAppliance) : undefined;

  const { data: checksData, isLoading } = useQuery({
    queryKey: ["checks", "history", applianceId, filterWatch],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (applianceId) params.appliance_id = applianceId;
      if (filterWatch !== "all") params.watch = filterWatch;
      const result = await backend.appliance.listChecks(params);
      return result;
    },
  });

  const { data: checkDetail } = useQuery({
    queryKey: ["check-detail", selectedCheckId],
    queryFn: async () => {
      if (!selectedCheckId) return null;
      const result = await backend.appliance.getCheck(selectedCheckId);
      return result;
    },
    enabled: !!selectedCheckId,
  });

  const checks = checksData?.checks || [];

  const getApplianceCallSign = (applianceId: number) => {
    return appliances.find((a) => a.id === applianceId)?.call_sign || "Unknown";
  };

  const handleViewDetail = (checkId: number) => {
    setSelectedCheckId(checkId);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Appliance</Label>
          <Select value={filterAppliance} onValueChange={setFilterAppliance}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All appliances" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Appliances</SelectItem>
              {appliances.map((a) => (
                <SelectItem key={a.id} value={a.id.toString()}>
                  {a.call_sign}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Watch</Label>
          <Select value={filterWatch} onValueChange={setFilterWatch}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All watches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Watches</SelectItem>
              <SelectItem value="Day">Day Shift</SelectItem>
              <SelectItem value="Night">Night Shift</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : checks.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No checks recorded yet</p>
          <p className="text-sm text-muted-foreground mt-1">Start a check from the Appliances tab to begin tracking equipment status.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Appliance</TableHead>
                <TableHead>Watch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checks.map((check) => (
                <TableRow key={check.id}>
                  <TableCell className="font-medium">
                    {format(new Date(check.started_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getApplianceCallSign(check.appliance_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{check.watch} Shift</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        check.status === "Complete" ? "default" : "secondary"
                      }
                      className={
                        check.status === "Complete"
                          ? "bg-green-600"
                          : ""
                      }
                    >
                      {check.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {check.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewDetail(check.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {/* Check Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              J4 Check Details
              {checkDetail && (
                <span className="text-muted-foreground font-normal text-sm ml-2">
                  — {format(new Date(checkDetail.check.started_at), "dd MMM yyyy HH:mm")}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {checkDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Checked By</span>
                  <p className="font-medium flex items-center gap-1 mt-1">
                    <User className="h-3.5 w-3.5" />
                    {checkDetail.checked_by_name}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Appliance</span>
                  <p className="font-medium mt-1">
                    {getApplianceCallSign(checkDetail.check.appliance_id)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Watch</span>
                  <p className="mt-1">
                    <Badge variant="secondary">
                      {checkDetail.check.watch} Shift
                    </Badge>
                  </p>
                </div>
              </div>

              {checkDetail.check.notes && (
                <div className="text-sm bg-muted rounded-lg p-3">
                  <span className="text-muted-foreground">Notes: </span>
                  {checkDetail.check.notes}
                </div>
              )}

              <div className="space-y-2">
                {checkDetail.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      item.status === "Defective"
                        ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                        : item.status === "Missing"
                        ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.status === "OK" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : item.status === "Defective" ? (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <span className="font-medium">{item.equipment_name}</span>
                        {item.equipment_serial && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            S/N: {item.equipment_serial}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({item.equipment_category})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span>
                        Qty: {item.quantity_checked}
                      </span>
                      <Badge
                        variant={
                          item.status === "OK"
                            ? "default"
                            : item.status === "Defective"
                            ? "secondary"
                            : "destructive"
                        }
                        className={
                          item.status === "OK" ? "bg-green-600" : ""
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
