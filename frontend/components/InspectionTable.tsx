import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import backend from "@/lib/backend";
import type { Inspection, InspectionType, InspectionStatus } from "~backend/inspection/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Filter, Eye, LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface InspectionTableProps {
  onViewDetails?: (inspection: Inspection) => void;
  onEditInspection?: (inspection: Inspection) => void;
  viewMode?: "table" | "calendar";
  onViewModeChange?: (mode: "table" | "calendar") => void;
}

export default function InspectionTable({ onViewDetails, onEditInspection, viewMode = "table", onViewModeChange }: InspectionTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>("_all");
  const [statusFilter, setStatusFilter] = useState<string>("_all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: inspectionsData, isLoading } = useQuery({
    queryKey: ["inspections", typeFilter, statusFilter],
    queryFn: async () => {
      return await backend.inspection.list({
        inspection_type: typeFilter !== "_all" ? typeFilter : undefined,
        status: statusFilter !== "_all" ? (statusFilter as InspectionStatus) : undefined,
        limit: 100,
      });
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const result = await backend.user.list({ limit: 200 });
      return result.users;
    },
  });

  const userMap = new Map(usersData?.map((u) => [u.id, u.name]) || []);

  const inspections = inspectionsData?.inspections || [];

  const filteredInspections = inspections.filter((inspection) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return inspection.address.toLowerCase().includes(search);
    }
    return true;
  });

  const getStatusBadge = (status: InspectionStatus) => {
    const colors = {
      Planned: "bg-blue-500/10 text-blue-500",
      InProgress: "bg-yellow-500/10 text-yellow-500",
      Complete: "bg-green-500/10 text-green-500",
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-gray-500/10 text-gray-400",
      medium: "bg-blue-500/10 text-blue-500",
      high: "bg-orange-500/10 text-orange-500",
      critical: "bg-red-500/10 text-red-500",
    };
    return (
      <Badge className={colors[priority as keyof typeof colors] || ""}>
        {priority}
      </Badge>
    );
  };

  const getTypeBadge = (type: InspectionType) => {
    const colors = {
      HighRise: "bg-purple-500/10 text-purple-500",
      LocalProperty: "bg-cyan-500/10 text-cyan-500",
      Hydrant: "bg-indigo-500/10 text-indigo-500",
      Other: "bg-gray-500/10 text-gray-400",
    };
    const labels = {
      HighRise: "High Rise",
      LocalProperty: "Local Property",
      Hydrant: "Hydrant",
      Other: "Other",
    };
    return (
      <Badge className={colors[type]}>
        {labels[type]}
      </Badge>
    );
  };

  const activeFiltersCount = [typeFilter, statusFilter].filter(f => f && f !== "_all").length;

  const clearFilters = () => {
    setTypeFilter("_all");
    setStatusFilter("_all");
    setSearchTerm("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex gap-2">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange?.("table")}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Table
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange?.("calendar")}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Calendar
          </Button>
        </div>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All types</SelectItem>
              <SelectItem value="HighRise">High Rise</SelectItem>
              <SelectItem value="LocalProperty">Local Property</SelectItem>
              <SelectItem value="Hydrant">Hydrant</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              <SelectItem value="Planned">Planned</SelectItem>
              <SelectItem value="InProgress">In Progress</SelectItem>
              <SelectItem value="Complete">Complete</SelectItem>
            </SelectContent>
          </Select>
          {activeFiltersCount > 0 && (
            <Button variant="outline" onClick={clearFilters}>
              <Filter className="h-4 w-4 mr-2" />
              Clear ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Assigned Crew</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : filteredInspections.length > 0 ? (
              filteredInspections.map((inspection) => (
                <TableRow
                  key={inspection.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onViewDetails?.(inspection)}
                >
                  <TableCell>{getTypeBadge(inspection.type)}</TableCell>
                  <TableCell className="font-medium">{inspection.address}</TableCell>
                  <TableCell>{getPriorityBadge(inspection.priority)}</TableCell>
                  <TableCell>
                    {new Date(inspection.scheduled_for).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {inspection.assigned_crew_ids && inspection.assigned_crew_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {inspection.assigned_crew_ids.slice(0, 3).map((id) => (
                          <Badge key={id} variant="outline" className="text-xs">
                            {userMap.get(id) || `User ${id.slice(0, 8)}`}
                          </Badge>
                        ))}
                        {inspection.assigned_crew_ids.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{inspection.assigned_crew_ids.length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(inspection.status)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditInspection?.(inspection)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {activeFiltersCount > 0 || searchTerm
                    ? "No inspections match the filters"
                    : "No inspections found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
