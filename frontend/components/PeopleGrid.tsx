import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, Grid3x3, List, Award, Car, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "~backend/user/types";
import type { FirefighterProfile } from "~backend/profile/types";

interface PeopleData {
  user: User;
  profile?: FirefighterProfile;
}

interface PeopleGridProps {
  data: PeopleData[];
  isLoading?: boolean;
}

interface Filters {
  search: string;
  role: string;
  station: string;
  shift: string;
  hasBA: string;
  hasPRPS: string;
  hasDriver: string;
}

export default function PeopleGrid({ data, isLoading }: PeopleGridProps) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    role: "all",
    station: "all",
    shift: "all",
    hasBA: "all",
    hasPRPS: "all",
    hasDriver: "all",
  });

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      role: "all",
      station: "all",
      shift: "all",
      hasBA: "all",
      hasPRPS: "all",
      hasDriver: "all",
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.role !== "all" ||
    filters.station !== "all" ||
    filters.shift !== "all" ||
    filters.hasBA !== "all" ||
    filters.hasPRPS !== "all" ||
    filters.hasDriver !== "all";

  const filterData = (data: PeopleData[]): PeopleData[] => {
    return data.filter(({ user, profile }) => {
      if (
        filters.search &&
        !user.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !user.email.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      if (filters.role !== "all" && user.role !== filters.role) {
        return false;
      }

      if (filters.station !== "all" && profile?.station !== filters.station) {
        return false;
      }

      if (filters.shift !== "all" && profile?.shift !== filters.shift) {
        return false;
      }

      if (filters.hasBA === "yes" && !profile?.ba) return false;
      if (filters.hasBA === "no" && profile?.ba) return false;

      if (filters.hasPRPS === "yes" && !profile?.prps) return false;
      if (filters.hasPRPS === "no" && profile?.prps) return false;

      if (filters.hasDriver === "yes" && !profile?.driver?.lgv && !profile?.driver?.erd) return false;
      if (filters.hasDriver === "no" && (profile?.driver?.lgv || profile?.driver?.erd)) return false;

      return true;
    });
  };

  const filteredData = filterData(data);

  const uniqueStations = Array.from(new Set(data.map((d) => d.profile?.station).filter(Boolean)));
  const uniqueShifts = Array.from(new Set(data.map((d) => d.profile?.shift).filter(Boolean)));

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      WC: "bg-red-500/10 text-red-500 border-red-500/20",
      CC: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      FF: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      RO: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    };
    const labels: Record<string, string> = {
      WC: "WC",
      CC: "CC",
      FF: "FF",
      RO: "RO",
    };
    return (
      <Badge className={colors[role] || ""} variant="outline">
        {labels[role] || role}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <Badge className="ml-2 bg-red-500 text-white h-5 w-5 p-0 flex items-center justify-center text-xs">
              !
            </Badge>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
        <Button variant={viewMode === "grid" ? "default" : "outline"} size="icon" onClick={() => setViewMode("grid")}>
          <Grid3x3 className="h-4 w-4" />
        </Button>
        <Button variant={viewMode === "table" ? "default" : "outline"} size="icon" onClick={() => setViewMode("table")}>
          <List className="h-4 w-4" />
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Role</label>
                <Select value={filters.role} onValueChange={(v) => updateFilter("role", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="WC">Watch Commander</SelectItem>
                    <SelectItem value="CC">Crew Commander</SelectItem>
                    <SelectItem value="FF">Firefighter</SelectItem>
                    <SelectItem value="RO">Read Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Station</label>
                <Select value={filters.station} onValueChange={(v) => updateFilter("station", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stations</SelectItem>
                    {uniqueStations.map((station) => (
                      <SelectItem key={station} value={station || ""}>
                        {station}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Shift</label>
                <Select value={filters.shift} onValueChange={(v) => updateFilter("shift", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    {uniqueShifts.map((shift) => (
                      <SelectItem key={shift} value={shift || ""}>
                        {shift}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">BA Qualified</label>
                <Select value={filters.hasBA} onValueChange={(v) => updateFilter("hasBA", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">PRPS</label>
                <Select value={filters.hasPRPS} onValueChange={(v) => updateFilter("hasPRPS", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Driver (LGV/ERD)</label>
                <Select value={filters.hasDriver} onValueChange={(v) => updateFilter("hasDriver", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-sm text-muted-foreground">
        Showing {filteredData.length} of {data.length} people
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
          ) : (
            filteredData.map(({ user, profile }) => (
              <Card
                key={user.id}
                className="cursor-pointer hover:border-indigo-600 transition-colors"
                onClick={() => navigate(`/people/${user.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{user.name}</CardTitle>
                      <CardDescription>{profile?.service_number || user.email}</CardDescription>
                    </div>
                    {getRoleBadge(user.role)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {profile?.station && (
                      <div className="text-sm text-muted-foreground">
                        📍 {profile.station} {profile.shift && `• ${profile.shift}`}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {profile?.ba && (
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          BA
                        </Badge>
                      )}
                      {profile?.prps && (
                        <Badge variant="outline" className="text-xs">
                          <Award className="h-3 w-3 mr-1" />
                          PRPS
                        </Badge>
                      )}
                      {(profile?.driver?.lgv || profile?.driver?.erd) && (
                        <Badge variant="outline" className="text-xs">
                          <Car className="h-3 w-3 mr-1" />
                          {profile.driver.lgv && profile.driver.erd ? "LGV+ERD" : profile.driver.lgv ? "LGV" : "ERD"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {isLoading ? (
                [...Array(10)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : (
                filteredData.map(({ user, profile }) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-indigo-600 transition-colors cursor-pointer"
                    onClick={() => navigate(`/people/${user.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground">{user.name}</h4>
                        {getRoleBadge(user.role)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {profile?.service_number && <span>#{profile.service_number}</span>}
                        {profile?.station && <span>📍 {profile.station}</span>}
                        {profile?.shift && <span>{profile.shift}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {profile?.ba && (
                        <Badge variant="outline" className="text-xs">
                          BA
                        </Badge>
                      )}
                      {profile?.prps && (
                        <Badge variant="outline" className="text-xs">
                          PRPS
                        </Badge>
                      )}
                      {(profile?.driver?.lgv || profile?.driver?.erd) && (
                        <Badge variant="outline" className="text-xs">
                          Driver
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredData.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {hasActiveFilters ? "No people match the current filters" : "No people found"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
