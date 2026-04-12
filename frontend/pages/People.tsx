import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBackend, useCanViewPeople, useCanCreatePerson, useIsWatchCommander, useIsCrewCommander } from "@/lib/rbac";
import { useAuth } from "@/App";
import { STATION_OPTIONS } from "@/lib/constants";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Search, UserPlus, Settings2, ChevronDown, ChevronUp, BookOpen, Stethoscope, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AddPersonModal from "@/components/AddPersonModal";
import ColumnsDrawer from "@/components/ColumnsDrawer";
import DictionaryManager from "@/components/DictionaryManager";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WatchBadge, WatchDot } from "@/components/WatchBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

type SortField = "name" | "watch" | "rank" | "email" | "phone" | "staffNumber" | "lastConversation";
type SortDirection = "asc" | "desc";

const WATCH_OPTIONS = ["Green", "Red", "White", "Blue", "Amber"];
const RANK_OPTIONS = ["Watch Commander", "Crew Commander", "Leading Firefighter", "Firefighter"];
const RANK_ORDER: Record<string, number> = {
  "Watch Commander": 1,
  "Crew Commander": 2,
  "Leading Firefighter": 3,
  "Firefighter": 4,
};

const DRIVER_PATHWAY_STATUS_LABELS: Record<string, string> = {
  medical_due: "Medical Due",
  application_sent: "App Sent",
  awaiting_theory: "Awaiting Theory",
  awaiting_course: "Awaiting Course",
  passed_LGV: "Passed LGV",
  awaiting_ERD: "Awaiting ERD",
  passed: "Passed",
};

const DRIVER_PATHWAY_COLORS: Record<string, string> = {
  medical_due: "bg-yellow-500/10 text-yellow-500",
  application_sent: "bg-blue-500/10 text-blue-500",
  awaiting_theory: "bg-purple-500/10 text-purple-500",
  awaiting_course: "bg-orange-500/10 text-orange-500",
  passed_LGV: "bg-green-500/10 text-green-500",
  awaiting_ERD: "bg-teal-500/10 text-teal-500",
  passed: "bg-emerald-500/10 text-emerald-500",
};

export default function People() {
  const backend = useBackend();
  const navigate = useNavigate();
  const canView = useCanViewPeople();
  const canCreate = useCanCreatePerson();
  const isWC = useIsWatchCommander();
  const canLogSick = useIsCrewCommander(); // WC or CC
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    (searchParams.get("status") as any) || "all"
  );
  const [watchFilters, setWatchFilters] = useState<string[]>(
    searchParams.get("watch")?.split(",").filter(Boolean) || []
  );
  const [rankFilters, setRankFilters] = useState<string[]>(
    searchParams.get("rank")?.split(",").filter(Boolean) || []
  );
  const [skillFilters, setSkillFilters] = useState<string[]>(
    searchParams.get("skills")?.split(",").filter(Boolean) || []
  );
  const [driverPathwayFilter, setDriverPathwayFilter] = useState(
    searchParams.get("driverPathway") || ""
  );
  const [stationFilter, setStationFilter] = useState<string>(searchParams.get("station") || "");
  const [sortField, setSortField] = useState<SortField>(
    (searchParams.get("sortBy") as SortField) || "watch"
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    (searchParams.get("sortDir") as SortDirection) || "asc"
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showColumnsDrawer, setShowColumnsDrawer] = useState(false);
  const [showSkillsManager, setShowSkillsManager] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    watch: true,
    phone: true,
    email: true,
    rank: true,
    staffNumber: true,
    niNumber: false,
    skills: true,
    driverPathway: true,
    absence: true,
    lastConversation: true,
  });

  const { user: authUser } = useAuth();

  const [logSickOpen, setLogSickOpen] = useState(false);
  const [logSickPerson, setLogSickPerson] = useState<{ id: string; name: string } | null>(null);
  const [logSickReason, setLogSickReason] = useState("");
  const [logSickEformConfirmed, setLogSickEformConfirmed] = useState(false);

  if (!canView) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">Access Denied</p>
            <p>You need Watch Commander or Crew Commander role to access People.</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter !== "all") params.status = statusFilter;
    if (watchFilters.length) params.watch = watchFilters.join(",");
    if (rankFilters.length) params.rank = rankFilters.join(",");
    if (skillFilters.length) params.skills = skillFilters.join(",");
    if (driverPathwayFilter) params.driverPathway = driverPathwayFilter;
    if (stationFilter) params.station = stationFilter;
    if (sortField !== "watch") params.sortBy = sortField;
    if (sortDirection !== "asc") params.sortDir = sortDirection;

    setSearchParams(params);
  }, [debouncedSearch, statusFilter, watchFilters, rankFilters, skillFilters, driverPathwayFilter, stationFilter, sortField, sortDirection, setSearchParams]);

  const { data: peopleData, isLoading } = useQuery({
    queryKey: ["people", statusFilter],
    queryFn: async () => {
      return await backend.profile.listWithUsers({ limit: 500, status: statusFilter });
    },
  });

  const { data: skillsData } = useQuery({
    queryKey: ["dictionaries", "skills"],
    queryFn: async () => backend.dictionary.list({ type: "skill" }),
  });

  const { data: sickToday } = useQuery({
    queryKey: ["absences", "sick-today"],
    queryFn: async () => {
      const result = await backend.absence.list({ status: "approved", limit: 200 });
      const todayStr = new Date().toISOString().split("T")[0];
      return new Set(
        result.absences
          .filter(
            (a) =>
              a.type === "sickness" &&
              a.start_date.slice(0, 10) <= todayStr &&
              a.end_date.slice(0, 10) >= todayStr
          )
          .map((a) => a.firefighter_id)
      );
    },
    refetchInterval: 60_000,
  });

  const logSickMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const todayStr = new Date().toISOString().split("T")[0];
      return await backend.absence.create({
        user_id: userId,
        type: "sickness",
        start_date: todayStr,
        end_date: todayStr,
        reason: logSickReason || "Sick booking logged via Watch Commander Ops Hub",
        evidence_urls: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences", "sick-today"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setLogSickOpen(false);
      setLogSickPerson(null);
      setLogSickReason("");
      setLogSickEformConfirmed(false);
    },
  });

  const people = peopleData?.people || [];

  // Default station filter to user's station
  useEffect(() => {
    if (peopleData && authUser && !stationFilter && !searchParams.get("station")) {
      const myProfile = peopleData.people?.find((p: any) => p.user.id === authUser.id);
      if (myProfile?.profile?.station) {
        setStationFilter(myProfile.profile.station);
      }
    }
  }, [peopleData, authUser]);

  const availableSkills = useMemo(() => {
    if (skillsData?.items && skillsData.items.length > 0) {
      return skillsData.items
        .filter(skill => skill.active)
        .map(skill => skill.value)
        .sort();
    }
    return [];
  }, [skillsData]);

  const filteredAndSortedPeople = useMemo(() => {
    let filtered = people.filter((person) => {
      const { user, profile } = person;
      
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const matchesSearch = 
          user.name.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search) ||
          profile?.service_number?.toLowerCase().includes(search) ||
          profile?.skills?.some(s => s.toLowerCase().includes(search)) ||
          profile?.notes?.toLowerCase().includes(search) ||
          profile?.lastConversation?.text?.toLowerCase().includes(search);
        
        if (!matchesSearch) return false;
      }
      
      const effectiveWatch = user.watch_unit || profile?.watch || "";
      if (watchFilters.length && !watchFilters.includes(effectiveWatch)) return false;
      const effectiveStation = profile?.station || "";
      if (stationFilter && stationFilter.trim() && effectiveStation !== stationFilter) return false;
      if (rankFilters.length && !rankFilters.includes(profile?.rank || "")) return false;
      if (skillFilters.length && !skillFilters.some(sf => profile?.skills?.includes(sf))) return false;
      if (driverPathwayFilter && profile?.driverPathway?.status !== driverPathwayFilter) return false;
      
      return true;
    });

    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortField === "watch") {
        const watchA = a.user.watch_unit || a.profile?.watch || "";
        const watchB = b.user.watch_unit || b.profile?.watch || "";
        comparison = watchA.localeCompare(watchB);
        
        if (comparison === 0) {
          const rankA = RANK_ORDER[a.profile?.rank as keyof typeof RANK_ORDER] || 999;
          const rankB = RANK_ORDER[b.profile?.rank as keyof typeof RANK_ORDER] || 999;
          comparison = rankA - rankB;
          
          if (comparison === 0) {
            comparison = a.user.name.localeCompare(b.user.name);
          }
        }
      } else if (sortField === "rank") {
        const rankA = RANK_ORDER[a.profile?.rank as keyof typeof RANK_ORDER] || 999;
        const rankB = RANK_ORDER[b.profile?.rank as keyof typeof RANK_ORDER] || 999;
        comparison = rankA - rankB;
      } else if (sortField === "name") {
        comparison = a.user.name.localeCompare(b.user.name);
      } else if (sortField === "email") {
        comparison = a.user.email.localeCompare(b.user.email);
      } else if (sortField === "phone") {
        comparison = (a.profile?.phone || "").localeCompare(b.profile?.phone || "");
      } else if (sortField === "staffNumber") {
        comparison = (a.profile?.service_number || "").localeCompare(b.profile?.service_number || "");
      } else if (sortField === "lastConversation") {
        const dateA = a.profile?.lastConversation?.date || "";
        const dateB = b.profile?.lastConversation?.date || "";
        comparison = dateA.localeCompare(dateB);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [people, debouncedSearch, watchFilters, rankFilters, skillFilters, driverPathwayFilter, stationFilter, sortField, sortDirection]);

  const activeFiltersCount =
    [watchFilters.length > 0, rankFilters.length > 0, skillFilters.length > 0, !!driverPathwayFilter, !!(stationFilter && stationFilter.trim())].filter(Boolean).length +
    (statusFilter !== "active" ? 1 : 0);

  const clearFilters = () => {
    setWatchFilters([]);
    setRankFilters([]);
    setSkillFilters([]);
    setDriverPathwayFilter("");
    setStationFilter("");
    setStatusFilter("active");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const toggleFilter = (value: string, filters: string[], setFilters: (f: string[]) => void) => {
    if (filters.includes(value)) {
      setFilters(filters.filter(f => f !== value));
    } else {
      setFilters([...filters, value]);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Users className="h-7 w-7 text-indigo-500 shrink-0" />
            People
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredAndSortedPeople.length} {filteredAndSortedPeople.length === 1 ? 'person' : 'people'}
            {activeFiltersCount > 0 && ` (${activeFiltersCount} filter${activeFiltersCount === 1 ? '' : 's'} active)`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <Button variant="outline" onClick={() => setShowSkillsManager(true)}>
              <BookOpen className="h-4 w-4 mr-2" />
              Manage Skills
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowColumnsDrawer(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Columns
          </Button>
          {canCreate && (
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowAddModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Person
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, staff number, skills, notes, or conversations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filters</CardTitle>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Station</label>
              <Select value={stationFilter} onValueChange={setStationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Stations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All Stations</SelectItem>
                  {STATION_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Active only" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Current staff</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inactive">Left station</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Watch ({watchFilters.length})</label>
              <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
                {WATCH_OPTIONS.map(watch => (
                  <label key={watch} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                    <Checkbox
                      checked={watchFilters.includes(watch)}
                      onCheckedChange={() => toggleFilter(watch, watchFilters, setWatchFilters)}
                    />
                    <WatchDot watch={watch} size="sm" />
                    <span className="text-sm">{watch}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Rank ({rankFilters.length})</label>
              <div className="border rounded-md p-2 space-y-1">
                {RANK_OPTIONS.map(rank => (
                  <label key={rank} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                    <Checkbox
                      checked={rankFilters.includes(rank)}
                      onCheckedChange={() => toggleFilter(rank, rankFilters, setRankFilters)}
                    />
                    <span className="text-sm leading-tight">{rank}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Skills ({skillFilters.length})</label>
              <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
                {availableSkills.map(skill => (
                  <label key={skill} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                    <Checkbox
                      checked={skillFilters.includes(skill)}
                      onCheckedChange={() => toggleFilter(skill, skillFilters, setSkillFilters)}
                    />
                    <span className="text-sm">{skill}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Driver Pathway</label>
              <Select value={driverPathwayFilter} onValueChange={setDriverPathwayFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All</SelectItem>
                  {Object.entries(DRIVER_PATHWAY_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.name && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                    <div className="flex items-center gap-1">
                      Name <SortIcon field="name" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.watch && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort("watch")}>
                    <div className="flex items-center gap-1">
                      Watch <SortIcon field="watch" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.phone && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort("phone")}>
                    <div className="flex items-center gap-1">
                      Phone <SortIcon field="phone" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.email && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort("email")}>
                    <div className="flex items-center gap-1">
                      Email <SortIcon field="email" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.rank && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort("rank")}>
                    <div className="flex items-center gap-1">
                      Rank <SortIcon field="rank" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.staffNumber && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort("staffNumber")}>
                    <div className="flex items-center gap-1">
                      Staff # <SortIcon field="staffNumber" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.niNumber && <TableHead>NI Number</TableHead>}
                {visibleColumns.skills && <TableHead>Skills</TableHead>}
                {visibleColumns.driverPathway && <TableHead>Driver Pathway</TableHead>}
                {visibleColumns.absence && <TableHead>Absence (6m/1y)</TableHead>}
                {visibleColumns.lastConversation && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort("lastConversation")}>
                    <div className="flex items-center gap-1">
                      Last Conv. <SortIcon field="lastConversation" />
                    </div>
                  </TableHead>
                )}
                {canLogSick && <TableHead className="w-28">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedPeople.map((person) => {
                const { user, profile } = person;
                return (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/people/${user.id}`)}
                  >
                    {visibleColumns.name && (
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          {user.name}
                          {sickToday?.has(user.id) && (
                            <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20 gap-1 shrink-0">
                              <Stethoscope className="h-3 w-3" /> Off Sick
                            </Badge>
                          )}
                          {!user.is_active && !user.left_at && (
                            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                              Pending Login
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.watch && (
                      <TableCell>
                        {(user.watch_unit || profile?.watch) ? (
                          <WatchBadge watch={(user.watch_unit || profile?.watch)!} />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.phone && (
                      <TableCell>{profile?.phone || "-"}</TableCell>
                    )}
                    {visibleColumns.email && (
                      <TableCell className="text-sm">{user.email}</TableCell>
                    )}
                    {visibleColumns.rank && (
                      <TableCell>{profile?.rank || "-"}</TableCell>
                    )}
                    {visibleColumns.staffNumber && (
                      <TableCell>{profile?.service_number || "-"}</TableCell>
                    )}
                    {visibleColumns.niNumber && (
                      <TableCell>{profile?.customFields?.niNumber || "-"}</TableCell>
                    )}
                    {visibleColumns.skills && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {profile?.skills && profile.skills.length > 0 ? (
                            <>
                              {profile.skills.slice(0, 3).map((skill, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                              {profile.skills.length > 3 && (
                                <span className="text-xs text-muted-foreground">+{profile.skills.length - 3}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.driverPathway && (
                      <TableCell>
                        {profile?.driverPathway ? (
                          <div className="space-y-1">
                            <Badge className={DRIVER_PATHWAY_COLORS[profile.driverPathway.status] || ""}>
                              {DRIVER_PATHWAY_STATUS_LABELS[profile.driverPathway.status] || profile.driverPathway.status}
                            </Badge>
                            {profile.driverPathway.lgvPassedDate && (
                              <div className="text-xs text-muted-foreground">
                                LGV: {new Date(profile.driverPathway.lgvPassedDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.absence && (
                      <TableCell>
                        <div className="text-sm">
                          <div>{profile?.rolling_sick_days || 0} days</div>
                          <div className="text-xs text-muted-foreground">
                            {profile?.rolling_sick_episodes || 0} episodes
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.lastConversation && (
                      <TableCell>
                        {profile?.lastConversation ? (
                          <div className="text-sm max-w-xs">
                            <div className="font-medium">
                              {new Date(profile.lastConversation.date).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {profile.lastConversation.text}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    {canLogSick && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {sickToday?.has(user.id) ? (
                          <Badge variant="outline" className="text-xs text-red-600 border-red-500/30 gap-1">
                            <Stethoscope className="h-3 w-3" /> Booked Off
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => {
                              logSickMutation.reset();
                              setLogSickPerson({ id: user.id, name: user.name });
                              setLogSickOpen(true);
                            }}
                          >
                            <Stethoscope className="h-3 w-3 mr-1" />
                            Log Sick
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      {filteredAndSortedPeople.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium text-foreground">
              {activeFiltersCount > 0 ? "No people match the filters" : "No people found"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeFiltersCount > 0
                ? "Try adjusting the filters to see more results."
                : "Add people to your watch to get started."}
            </p>
          </CardContent>
        </Card>
      )}

      <AddPersonModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
      <ColumnsDrawer
        isOpen={showColumnsDrawer}
        onClose={() => setShowColumnsDrawer(false)}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        canManageSchema={isWC}
      />
      {showSkillsManager && (
        <DictionaryManager
          isOpen={showSkillsManager}
          onClose={() => setShowSkillsManager(false)}
          type="skill"
        />
      )}

      {/* Log Sick Modal */}
      <Dialog
        open={logSickOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLogSickOpen(false);
            setLogSickPerson(null);
            setLogSickReason("");
            setLogSickEformConfirmed(false);
            logSickMutation.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-red-500" />
              Log Sick Booking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Firefighter</p>
              <p className="font-semibold">{logSickPerson?.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Date</p>
              <p className="font-semibold">
                {new Date().toLocaleDateString("en-GB", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div>
              <Label htmlFor="sick-reason" className="text-sm font-medium">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="sick-reason"
                placeholder="Any additional notes about this sick booking..."
                className="mt-1.5 resize-none"
                rows={3}
                value={logSickReason}
                onChange={(e) => setLogSickReason(e.target.value)}
              />
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
              <Checkbox
                id="eform-confirmed"
                checked={logSickEformConfirmed}
                onCheckedChange={(checked) => setLogSickEformConfirmed(!!checked)}
                className="mt-0.5"
              />
              <label htmlFor="eform-confirmed" className="text-sm cursor-pointer leading-snug">
                <span className="font-medium">eForm submitted to central staffing</span>
                <span className="block text-muted-foreground text-xs mt-0.5">
                  Confirm the sickness eForm has been completed and submitted before logging
                </span>
              </label>
            </div>
            {logSickMutation.isError && (
              <p className="text-sm text-red-600">Failed to log sick booking. Please try again.</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setLogSickOpen(false);
                setLogSickPerson(null);
                setLogSickReason("");
                setLogSickEformConfirmed(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={!logSickEformConfirmed || logSickMutation.isPending || !logSickPerson}
              onClick={() => {
                if (logSickPerson) logSickMutation.mutate({ userId: logSickPerson.id });
              }}
            >
              {logSickMutation.isPending ? "Logging..." : "Confirm Sick Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
