import { filtersFromUrl, openingFilters, peopleFiltersKey } from "@/lib/peopleFilters";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBackend, useCanViewPeople, useCanCreatePerson, useIsWatchCommander, useIsCrewCommander } from "@/lib/rbac";
import { useAuth } from "@/App";
import { STATION_OPTIONS } from "@/lib/constants";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ShieldAlert, Search, UserPlus, Settings2, ChevronDown, ChevronRight, ChevronUp, HeartPulse, Stethoscope, Users, X, XCircle } from "lucide-react";
import AddPersonModal from "@/components/AddPersonModal";
import ColumnsDrawer from "@/components/ColumnsDrawer";
import { LogSickDialog } from "@/components/LogSickDialog";
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
import { invalidateAbsenceViews, localTodayIso, useSickOn } from "@/lib/absences";
import { useToast } from "@/components/ui/use-toast";

type SortField = "name" | "watch" | "rank" | "email" | "phone" | "staffNumber" | "lastConversation";
/** "?certs=expired" / "?certs=due": just the people with a certification in that state (from the Home alerts). */
type CertFilter = "expired" | "due";
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
  const { toast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  
  // Opens on the filters this person last left it on (kept on this device);
  // a link that carries its own filters wins. See lib/peopleFilters.
  const { user: authUser } = useAuth();
  const filtersKey = peopleFiltersKey(authUser?.id);
  const [{ opening, firstVisit }] = useState(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(filtersKey); } catch { /* private window */ }
    // First visit on this device (nothing saved, nothing in the link): start on your own station.
    return { opening: openingFilters(searchParams, saved), firstVisit: !saved && !filtersFromUrl(searchParams) };
  });

  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(opening.status);
  const [certFilter, setCertFilter] = useState<CertFilter | null>(() => {
    const c = searchParams.get("certs");
    return c === "expired" || c === "due" ? c : null;
  });
  // Station / rank / skills / driver filters fold away; the watch chips and
  // status switch stay in view.
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [watchFilters, setWatchFilters] = useState<string[]>(opening.watch);
  const [rankFilters, setRankFilters] = useState<string[]>(opening.rank);
  const [skillFilters, setSkillFilters] = useState<string[]>(opening.skills);
  const [driverPathwayFilter, setDriverPathwayFilter] = useState(opening.driverPathway);
  const [stationFilter, setStationFilter] = useState<string>(opening.station);
  const [sortField, setSortField] = useState<SortField>((opening.sortBy as SortField) || "watch");
  const [sortDirection, setSortDirection] = useState<SortDirection>(opening.sortDir);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showColumnsDrawer, setShowColumnsDrawer] = useState(false);
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

  const [logSickOpen, setLogSickOpen] = useState(false);
  const [logSickPerson, setLogSickPerson] = useState<{ id: string; name: string } | null>(null);

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
    // Kept in the link while it's on, but never saved as the filters you left.
    if (certFilter) params.certs = certFilter;

    setSearchParams(params, { replace: true });
    try {
      localStorage.setItem(filtersKey, JSON.stringify({
        status: statusFilter, watch: watchFilters, rank: rankFilters, skills: skillFilters,
        driverPathway: driverPathwayFilter, station: stationFilter, sortBy: sortField, sortDir: sortDirection,
      }));
    } catch { /* private window: it just won't be remembered */ }
  }, [filtersKey, debouncedSearch, statusFilter, watchFilters, rankFilters, skillFilters, driverPathwayFilter, stationFilter, sortField, sortDirection, certFilter, setSearchParams]);

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

  // Certifications expired or due within 30 days (same cache as the Home
  // alerts), so each person with one carries a warning here.
  const { data: expiringData } = useQuery({
    queryKey: ["wc-skills-expiring"],
    queryFn: async () => backend.skill.listExpiring(),
    refetchInterval: 5 * 60 * 1000,
  });
  const certsByUser = useMemo(() => {
    const m = new Map<string, { expired: string[]; due: string[] }>();
    for (const s of expiringData?.skills ?? []) {
      const c = m.get(s.user_id) ?? { expired: [], due: [] };
      (s.status === "expired" ? c.expired : c.due).push(s.skill_name);
      m.set(s.user_id, c);
    }
    return m;
  }, [expiringData]);
  const hasCert = (userId: string, which: CertFilter) => {
    const c = certsByUser.get(userId);
    return !!c && (which === "expired" ? c.expired.length > 0 : c.due.length > 0);
  };

  // Off sick today across the station (names only for other watches), so
  // an open sickness shows here and can't be booked a second time — by any
  // WC/CC, not just the person's own.
  const { data: sickOn } = useSickOn(localTodayIso());
  const sickToday = sickOn?.ids;

  // Any WC/CC who takes the call books them back fit; their own watch's
  // WC/CC are notified by the backend.
  const bookBackFit = useMutation({
    mutationFn: async (absenceId: number) => backend.absence.bookBackFit({ absence_id: absenceId }),
    onSuccess: (res) => {
      invalidateAbsenceViews(queryClient);
      queryClient.invalidateQueries({ queryKey: ["back-to-work"] });
      toast({
        title: "Booked back fit",
        description: `The WC and CC on their watch have been notified.${res.back_to_work_due ? ` Back to work interview due on their first shift back: ${res.back_to_work_due}.` : ""}`,
      });
    },
    onError: (err: any) =>
      toast({
        title: "Couldn't book back fit",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      }),
  });

  const people = peopleData?.people || [];

  // The first time only, start on your own station and your own watch (on a
  // phone the whole station is 39 cards before you reach your crew). After
  // that it's whatever you last left — including "all stations".
  useEffect(() => {
    if (firstVisit && peopleData && authUser && !stationFilter && !searchParams.get("station")) {
      const myProfile = peopleData.people?.find((p: any) => p.user.id === authUser.id);
      if (myProfile?.profile?.station) {
        setStationFilter(myProfile.profile.station);
      }
      const myWatch = authUser.watch_unit || myProfile?.profile?.watch;
      if (myWatch && watchFilters.length === 0 && !searchParams.get("watch")) {
        setWatchFilters([myWatch]);
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
          profile?.skills?.some(s => s.toLowerCase().includes(search));
        
        if (!matchesSearch) return false;
      }
      
      // From a Home alert: everyone with a cert in that state, whatever watch
      // or station the other filters are on (the banner above says so).
      if (certFilter) return hasCert(user.id, certFilter);

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
  }, [people, debouncedSearch, watchFilters, rankFilters, skillFilters, driverPathwayFilter, stationFilter, sortField, sortDirection, certFilter, certsByUser]);

  // With the cert filter on, a person opens on their Skills tab.
  const profileHref = (id: string) => `/people/${id}${certFilter ? "?tab=skills" : ""}`;

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
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────────────────────────
          Visual-refresh pattern: heading + eyebrow context line + spacer +
          action buttons. The eyebrow surfaces the active watch, station and
          counts so the WC has the same situational frame here as on the
          dashboard. */}
      <div className="flex items-start sm:items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-baseline flex-wrap gap-x-4 gap-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Users className="h-7 w-7 text-brand shrink-0" />
            People
          </h1>
          <span className="eyebrow whitespace-nowrap">
            {filteredAndSortedPeople.length} {filteredAndSortedPeople.length === 1 ? 'person' : 'people'}
            {activeFiltersCount > 0 && (
              <>
                <span className="crumb-sep">·</span>
                <span>{activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'} active</span>
              </>
            )}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {/* Columns belong to the table, which a phone doesn't show. */}
          <Button variant="outline" className="hidden md:inline-flex" onClick={() => setShowColumnsDrawer(true)} aria-label="Columns">
            <Settings2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Columns</span>
          </Button>
          {canCreate && (
            <Button
              className="bg-brand hover:bg-brand/90 text-brand-foreground"
              onClick={() => setShowAddModal(true)}
              aria-label="Add Person"
            >
              <UserPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Person</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, staff number, skills, notes, or conversations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card className="border-border/60 max-sm:gap-3 max-sm:py-3">
        <CardHeader className="pb-3 max-sm:px-3 max-sm:pb-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="eyebrow !text-foreground mr-1 max-sm:hidden">Filters</CardTitle>
              {/* One-tap watch chips — the filter people reach for most */}
              {WATCH_OPTIONS.map((watch) => {
                const on = watchFilters.includes(watch);
                return (
                  <button
                    key={watch}
                    type="button"
                    onClick={() => toggleFilter(watch, watchFilters, setWatchFilters)}
                    aria-pressed={on}
                    className={`tap-chip inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    <WatchDot watch={watch} size="sm" />
                    {watch}
                  </button>
                );
              })}
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
                  Clear all ({activeFiltersCount})
                </Button>
              )}
            </div>
            {/* Quick status switch — segmented control matches the design's
                .seg primitive. Backed by the same statusFilter state as the
                Select dropdown below — they're kept in sync. */}
            <div className="flex items-center gap-2 max-sm:w-full sm:flex-wrap">
            <div className="seg min-w-0 max-sm:flex-1 sm:w-[260px]">
              <button
                data-on={statusFilter === "active"}
                onClick={() => setStatusFilter("active")}
              >
                Current
              </button>
              <button
                data-on={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              <button
                data-on={statusFilter === "inactive"}
                onClick={() => setStatusFilter("inactive")}
              >
                Left<span className="max-sm:hidden"> station</span>
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-[30px] shrink-0 text-xs"
              onClick={() => setShowFilterPanel((v) => !v)}
              aria-expanded={showFilterPanel}
            >
              {showFilterPanel ? "Fewer filters" : "More filters"}
              <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${showFilterPanel ? "rotate-180" : ""}`} />
            </Button>
            </div>
          </div>
        </CardHeader>
        {showFilterPanel && (
        <CardContent className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="eyebrow mb-2 block">Station</label>
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
              <label className="eyebrow mb-2 block">Watch ({watchFilters.length})</label>
              <div className="border border-border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto bg-card">
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
              <label className="eyebrow mb-2 block">Rank ({rankFilters.length})</label>
              <div className="border border-border rounded-md p-2 space-y-1 bg-card">
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
              <label className="eyebrow mb-2 block">Skills ({skillFilters.length})</label>
              <div className="border border-border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto bg-card">
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
              <label className="eyebrow mb-2 block">Driver Pathway</label>
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
        )}
      </Card>

      {certFilter && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            certFilter === "expired"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
          }`}
        >
          {certFilter === "expired"
            ? <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            : <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span className="flex-1 min-w-0">
            <span className="font-semibold">
              {certFilter === "expired" ? "People with an expired certification" : "People with a certification due in 30 days"}
            </span>
            <span className="opacity-80"> — every watch. Tap someone to open their skills.</span>
          </span>
          <button
            type="button"
            onClick={() => setCertFilter(null)}
            className="tap-chip inline-flex shrink-0 items-center gap-1 rounded-md border border-current/30 bg-background/60 px-2.5 py-1 text-xs font-medium hover:bg-background"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Show everyone
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* ── MOBILE: card list (hidden on md+) ─────────────────────────── */}
          <div className="md:hidden space-y-2">
            {filteredAndSortedPeople.map((person) => {
              const { user, profile } = person;
              const watch = user.watch_unit || profile?.watch;
              const initials = user.name
                ?.split(" ")
                .map((p: string) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() ?? "?";
              const isSick = !!sickToday?.has(user.id);
              return (
                <div key={user.id} className="flex items-stretch overflow-hidden rounded-xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => navigate(profileHref(user.id))}
                    className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
                  >
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{user.name}</span>
                        <CertBadge certs={certsByUser.get(user.id)} compact />
                        {isSick && (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20 gap-1">
                            <Stethoscope className="h-2.5 w-2.5" /> Sick
                          </Badge>
                        )}
                        {!user.is_active && !user.left_at && (
                          <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {profile?.rank && <span className="truncate">{profile.rank}</span>}
                        {profile?.rank && watch && <span className="text-muted-foreground/40">·</span>}
                        {watch && <WatchBadge watch={watch} />}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                  </button>
                  {/* Whoever is on duty takes the call: any WC/CC can book
                      anyone off sick, and back fit (same as the table). */}
                  {canLogSick && !isSick && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogSickPerson({ id: user.id, name: user.name });
                        setLogSickOpen(true);
                      }}
                      aria-label={`Log ${user.name} off sick`}
                      className="flex w-[68px] shrink-0 flex-col items-center justify-center gap-1 border-l border-border/60 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 active:bg-muted/60"
                    >
                      <Stethoscope className="h-4 w-4" aria-hidden="true" />
                      Log sick
                    </button>
                  )}
                  {canLogSick && isSick && sickOn?.openAbsence.has(user.id) && user.id !== authUser?.id && (
                    <button
                      type="button"
                      disabled={bookBackFit.isPending}
                      onClick={() => {
                        if (confirm(`Book ${user.name} back fit for duty from today?`)) {
                          bookBackFit.mutate(sickOn.openAbsence.get(user.id)!);
                        }
                      }}
                      aria-label={`Mark ${user.name} fit`}
                      className="flex w-[68px] shrink-0 flex-col items-center justify-center gap-1 border-l border-border/60 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
                    >
                      <HeartPulse className="h-4 w-4" aria-hidden="true" />
                      Mark fit
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP: full table (hidden on mobile) ──────────────────────
              Uses the visual-refresh `plain` table style: mono uppercase
              headers, hairline borders, hover wash. The Table is wrapped
              in a card-flush div so the rounded outer frame still reads
              against the page background. */}
          <div className="card-flush hidden md:block">
            <div className="overflow-x-auto">
            <Table className="plain">
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
                    onClick={() => navigate(profileHref(user.id))}
                  >
                    {visibleColumns.name && (
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          {user.name}
                          <CertBadge certs={certsByUser.get(user.id)} />
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
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        {profile?.service_number || "—"}
                      </TableCell>
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
                          <div>{profile?.rolling_sick_days || 0} duty days</div>
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
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs text-red-600 border-red-500/30 gap-1">
                              <Stethoscope className="h-3 w-3" /> Booked Off
                            </Badge>
                            {sickOn?.openAbsence.has(user.id) && user.id !== authUser?.id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
                                disabled={bookBackFit.isPending}
                                onClick={() => {
                                  if (confirm(`Book ${user.name} back fit for duty from today?`)) {
                                    bookBackFit.mutate(sickOn.openAbsence.get(user.id)!);
                                  }
                                }}
                              >
                                Mark fit
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => {
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
        </div>
        </>
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

      {/* Log Sick — shared with CrewOnWatchTable. One endpoint, one UX,
          one place to edit if policy changes. */}
      <LogSickDialog
        open={logSickOpen}
        onOpenChange={setLogSickOpen}
        person={logSickPerson}
      />
    </div>
  );
}

/**
 * A warning on someone with a certification out of date (red) or due within
 * 30 days (amber); which ones is in the tooltip and read out to a screen reader.
 */
function CertBadge({ certs, compact }: { certs?: { expired: string[]; due: string[] }; compact?: boolean }) {
  if (!certs || (certs.expired.length === 0 && certs.due.length === 0)) return null;
  const expired = certs.expired.length > 0;
  const names = expired ? certs.expired : certs.due;
  const detail = `${expired ? "Expired" : "Due within 30 days"}: ${names.join(", ")}`
    + (expired && certs.due.length ? ` · due soon: ${certs.due.join(", ")}` : "");
  const Icon = expired ? XCircle : AlertTriangle;
  return (
    <Badge
      variant="outline"
      title={detail}
      className={`${compact ? "text-[10px]" : "text-xs"} gap-1 shrink-0 ${
        expired
          ? "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400"
          : "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"
      }`}
    >
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
      {expired ? "Cert expired" : "Cert due"}
      <span className="sr-only"> — {detail}</span>
    </Badge>
  );
}
