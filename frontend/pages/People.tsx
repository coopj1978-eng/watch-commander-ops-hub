import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBackend, useCanViewPeople, useCanCreatePerson, useIsWatchCommander } from "@/lib/rbac";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Search, UserPlus, Settings2, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
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
const RANK_OPTIONS = ["SC", "WC", "CC", "FF"];
const RANK_ORDER = { SC: 1, WC: 2, CC: 3, FF: 4 };

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

  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    (searchParams.get("status") as any) || "active"
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
    if (statusFilter !== "active") params.status = statusFilter;
    if (watchFilters.length) params.watch = watchFilters.join(",");
    if (rankFilters.length) params.rank = rankFilters.join(",");
    if (skillFilters.length) params.skills = skillFilters.join(",");
    if (driverPathwayFilter) params.driverPathway = driverPathwayFilter;
    if (sortField !== "watch") params.sortBy = sortField;
    if (sortDirection !== "asc") params.sortDir = sortDirection;
    
    setSearchParams(params);
  }, [debouncedSearch, statusFilter, watchFilters, rankFilters, skillFilters, driverPathwayFilter, sortField, sortDirection, setSearchParams]);

  const { data: peopleData, isLoading } = useQuery({
    queryKey: ["people", statusFilter],
    queryFn: async () => {
      return await backend.profile.listWithUsers({ limit: 500, status: statusFilter });
    },
  });

  const { data: skillsData } = useQuery({
    queryKey: ["dictionaries", "skills"],
    queryFn: async () => {
      const result = await backend.dictionary.list({ type: "skill" });
      return result.items;
    },
  });

  const people = peopleData?.people || [];
  const availableSkills = useMemo(() => {
    if (skillsData && skillsData.length > 0) {
      return skillsData
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
      
      if (watchFilters.length && !watchFilters.includes(profile?.watch || "")) return false;
      if (rankFilters.length && !rankFilters.includes(profile?.rank || "")) return false;
      if (skillFilters.length && !skillFilters.some(sf => profile?.skills?.includes(sf))) return false;
      if (driverPathwayFilter && profile?.driverPathway?.status !== driverPathwayFilter) return false;
      
      return true;
    });

    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortField === "watch") {
        const watchA = a.profile?.watch || "";
        const watchB = b.profile?.watch || "";
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
  }, [people, debouncedSearch, watchFilters, rankFilters, skillFilters, driverPathwayFilter, sortField, sortDirection]);

  const activeFiltersCount = 
    [watchFilters.length > 0, rankFilters.length > 0, skillFilters.length > 0, !!driverPathwayFilter].filter(Boolean).length +
    (statusFilter !== "active" ? 1 : 0);

  const clearFilters = () => {
    setWatchFilters([]);
    setRankFilters([]);
    setSkillFilters([]);
    setDriverPathwayFilter("");
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">People</h1>
          <p className="text-muted-foreground mt-1">
            {filteredAndSortedPeople.length} {filteredAndSortedPeople.length === 1 ? 'person' : 'people'}
            {activeFiltersCount > 0 && ` (${activeFiltersCount} filter${activeFiltersCount === 1 ? '' : 's'} active)`}
          </p>
        </div>
        <div className="flex gap-2">
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
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => setShowAddModal(true)}>
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Active only" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
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
                    <span className="text-sm">{rank}</span>
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
        <Card>
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
                        <div className="flex items-center gap-2">
                          {user.name}
                          {!user.is_active && (
                            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                              Pending Sign-up
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.watch && (
                      <TableCell>
                        {profile?.watch ? (
                          <WatchBadge watch={profile.watch} />
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {filteredAndSortedPeople.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {activeFiltersCount > 0 ? "No people match the selected filters" : "No people found"}
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
    </div>
  );
}
