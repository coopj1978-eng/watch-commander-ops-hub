import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import { useIsCrewCommander } from "@/lib/rbac";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogSickDialog } from "@/components/LogSickDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, ChevronRight, Stethoscope, Heart } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { invalidateAbsenceViews, latestAbsencePerPerson, useTodaysAbsences } from "@/lib/absences";

// ──────────────────────────────────────────────────────────────────────────────
// CrewOnWatchTable — read-only tabular view of the current watch's personnel,
// modelled on the "Crew on watch" table in the design refresh mockup.
//
// Joins three existing data sources, all of which have shared query caches
// with other components on the dashboard so this adds no extra network
// traffic:
//
//   1. backend.crewing.roster({ watch })    → id/name/rank/quals
//   2. backend.profile.list({ watch })      → service_number + trigger_stage
//   3. backend.absence.list({ today })      → today's sickness / leave
//
// Status column derivation (in priority order):
//   Absence triggers hit → "Triggers hit" (red) — never a stage; that's
//     the Station Commander's note on the attendance file
//   Sickness absence today → "Sick"
//   Non-sickness absence today → "Leave"
//   Otherwise → "On duty"
//
// This is deliberately a READ-ONLY table. Editing crew is still done on the
// Crewing board (/handover) with drag-and-drop — this component is the
// at-a-glance view an incoming WC wants to scan.
// ──────────────────────────────────────────────────────────────────────────────

type Status =
  | { kind: "stage3"; label: "Triggers hit" }
  | { kind: "sick"; label: "Sick" }
  | { kind: "leave"; label: "Leave" }
  | { kind: "on_duty"; label: "On duty" };

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status.kind === "stage3"
      ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
      : status.kind === "sick"
      ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
      : status.kind === "leave"
      ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
      : "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900";

  const dotCls =
    status.kind === "stage3"
      ? "bg-red-500"
      : status.kind === "sick"
      ? "bg-amber-500"
      : status.kind === "leave"
      ? "bg-blue-500"
      : "bg-green-500";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium border ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} aria-hidden />
      {status.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-bright to-brand text-[9px] font-mono font-semibold text-white shrink-0"
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

// Tiny coloured pill for a qualification
function Qual({ label, tone = "default" }: { label: string; tone?: "default" | "orange" | "blue" | "purple" | "amber" }) {
  const cls =
    tone === "orange"
      ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
      : tone === "blue"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
      : tone === "purple"
      ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex px-1.5 py-px rounded text-[9px] font-mono font-semibold tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

// Format a short rank label for the Rank column
function shortRank(m: { rank?: string; system_role: string }): string {
  if (m.rank) return m.rank;
  if (m.system_role === "WC") return "Watch Commander";
  if (m.system_role === "CC") return "Crew Commander";
  return "Firefighter";
}

/** `compact`: the dashboard's narrow crew list — who's off first, one line each. */
export function CrewOnWatchTable({ compact = false }: { compact?: boolean } = {}) {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const canLogSick = useIsCrewCommander(); // WC or CC

  // ── Log Sick dialog — shared component handles state, mutation, eForm
  //    gate, and cache invalidations (union of keys the old duplicated
  //    inline dialog invalidated). Parent just owns open/person.
  const [logSickOpen, setLogSickOpen] = useState(false);
  const [logSickPerson, setLogSickPerson] = useState<{ id: string; name: string } | null>(null);

  const openLogSickFor = (id: string, name: string) => {
    setLogSickPerson({ id, name });
    setLogSickOpen(true);
  };

  // Book a sick FF back fit. Closes the absence so the dashboard stops
  // counting them as off without needing the WC to fiddle with the
  // end_date field. Invalidates every cache that gates on "is this
  // person sick today" so the row flips to "On duty" immediately.
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bookBackFit = useMutation({
    mutationFn: async (absenceId: number) =>
      backend.absence.bookBackFit({ absence_id: absenceId }),
    onSuccess: (res) => {
      invalidateAbsenceViews(queryClient);
      queryClient.invalidateQueries({ queryKey: ["back-to-work"] });
      toast({
        title: "Booked back fit",
        description: res.back_to_work_due ? `Back to work interview due on their first shift back: ${res.back_to_work_due}.` : undefined,
      });
    },
    onError: (err: any) =>
      toast({
        title: "Couldn't book back fit",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      }),
  });

  // ── Shared caches ─────────────────────────────────────────────────────────
  const rosterQ = useQuery({
    queryKey: ["crewing-roster", watch],
    queryFn: async () => backend.crewing.roster({ watch }),
    enabled: !!watch,
  });

  const profilesQ = useQuery({
    queryKey: ["wc-profiles", watch],
    queryFn: async () => backend.profile.list({ watch: watch || undefined, limit: 200 }),
    enabled: !!watch,
  });

  const absencesQ = useTodaysAbsences();

  const isLoading = rosterQ.isLoading || profilesQ.isLoading || absencesQ.isLoading;

  // ── Join and derive ───────────────────────────────────────────────────────
  const members = rosterQ.data?.members ?? [];
  const profiles = profilesQ.data?.profiles ?? [];
  const absences = absencesQ.data?.absences ?? [];

  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));
  const absenceByUser = latestAbsencePerPerson(absences);

  const rows = members.map((m) => {
    const profile = profileByUser.get(m.id);
    const absence = absenceByUser.get(m.id);

    // Triggers hit isn't an absence — show it alongside the real status so
    // someone at work who has hit their triggers still counts as on duty.
    let status: Status;
    if (absence?.type === "sickness") {
      status = { kind: "sick", label: "Sick" };
    } else if (absence) {
      status = { kind: "leave", label: "Leave" };
    } else {
      status = { kind: "on_duty", label: "On duty" };
    }

    return {
      id: m.id,
      name: m.name,
      rank: shortRank(m),
      service_number: profile?.service_number,
      driver_lgv: m.driver_lgv,
      driver_erd: m.driver_erd,
      quals: [
        m.ba && "BA",
        m.prps && "PRPS",
        m.oic && "OIC",
        m.mass_decon && "DECON",
        m.hooklift_operator && "HOOKLIFT",
      ].filter(Boolean) as string[],
      status,
      stage3: !!profile?.trigger_stage && profile.trigger_stage !== "None", // absence triggers hit
      absence_id: absence?.id ?? null,
    };
  });

  // Sort: WC first → CC → FF, stage-3/sick/leave last inside each group so
  // the on-duty block is contiguous at the top — what a WC wants to scan.
  const rankOrder: Record<string, number> = { "Watch Commander": 0, "Crew Commander": 1, "Leading Firefighter": 2, "Firefighter": 3 };
  rows.sort((a, b) => {
    const statusOrder: Record<Status["kind"], number> = { on_duty: 0, stage3: 1, sick: 2, leave: 3 };
    const sDiff = statusOrder[a.status.kind] - statusOrder[b.status.kind];
    if (sDiff !== 0) return sDiff;
    const rDiff = (rankOrder[a.rank] ?? 9) - (rankOrder[b.rank] ?? 9);
    if (rDiff !== 0) return rDiff;
    return a.name.localeCompare(b.name);
  });

  const onDutyCount = rows.filter((r) => r.status.kind === "on_duty").length;

  if (compact) {
    const off = rows.filter((r) => r.status.kind !== "on_duty");
    const here = rows.filter((r) => r.status.kind === "on_duty");
    return (
      <section aria-label="Crew" className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Crew · {watch} Watch</h2>
          <Link to="/people" className="text-xs text-muted-foreground hover:text-foreground">
            {isLoading ? "…" : <><span className="font-mono tabular-nums text-foreground">{onDutyCount}/{rows.length}</span> available →</>}
          </Link>
        </div>
        {isLoading ? (
          <div className="mt-3 space-y-1.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No crew on {watch || "this"} watch.</p>
        ) : (
          <>
            {/* Who's off — the part a WC needs to act on. */}
            {off.length > 0 && (
              <ul className="mt-2 divide-y divide-border/50">
                {off.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-1.5">
                    <Link to={`/people/${r.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 hover:text-primary">
                      <Avatar name={r.name} />
                      <span className="min-w-0 truncate text-sm font-medium">{r.name}</span>
                    </Link>
                    {r.stage3 && <StatusBadge status={{ kind: "stage3", label: "Triggers hit" }} />}
                    <StatusBadge status={r.status} />
                    {canLogSick && r.status.kind === "sick" && r.absence_id && (
                      <button
                        onClick={() => bookBackFit.mutate(r.absence_id!)}
                        disabled={bookBackFit.isPending}
                        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                        title="Book back fit and close the sickness"
                      >
                        <Heart className="h-3 w-3" /> Fit
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* Everyone else, as names. */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {here.map((r) => (
                <Link
                  key={r.id}
                  to={`/people/${r.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 py-0.5 pl-0.5 pr-2.5 text-xs hover:bg-muted"
                  title={`${r.name}${r.stage3 ? " — absence triggers hit" : ""}`}
                >
                  <Avatar name={r.name} />
                  {r.name.split(" ")[0]} {r.name.split(" ").slice(-1)[0]?.[0]}
                  {r.stage3 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="Absence triggers hit" />}
                </Link>
              ))}
            </div>
            {canLogSick && here.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted">
                  <Stethoscope className="h-3.5 w-3.5" /> Log sick…
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[50vh] overflow-y-auto">
                  {here.map((r) => (
                    <DropdownMenuItem key={r.id} onSelect={() => openLogSickFor(r.id, r.name)}>{r.name}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
        <LogSickDialog open={logSickOpen} onOpenChange={setLogSickOpen} person={logSickPerson} />
      </section>
    );
  }

  return (
    <Card className="border-t-2 border-t-brand">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand" />
          <CardTitle className="text-sm font-medium">Crew on Watch</CardTitle>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {!isLoading && (
            <Badge variant="secondary" className="font-mono tabular-nums">
              {onDutyCount} / {rows.length} on duty
            </Badge>
          )}
          <Link
            to="/people"
            className="flex items-center gap-0.5 hover:text-primary transition-colors"
          >
            View people <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-1 px-4 pb-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground italic">
            No crew assigned to {watch || "this"} watch.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-b border-border/60 bg-muted/30">
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground pl-3 pr-2 sm:px-4 py-2">Name</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 hidden md:table-cell">Rank</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 hidden 2xl:table-cell">Service #</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 hidden md:table-cell">Driver</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 hidden sm:table-cell">Quals</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-2 sm:px-4 py-2">Status</th>
                  {canLogSick && (
                    <th className="text-right font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-2 sm:px-4 py-2 sm:w-28">
                      <span className="sr-only sm:not-sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="pl-3 pr-2 sm:px-4" style={{ paddingBlock: "var(--pad-row)" }}>
                      <Link
                        to={`/people/${r.id}`}
                        className="inline-flex items-center gap-2.5 min-w-0 hover:text-primary transition-colors"
                      >
                        <Avatar name={r.name} />
                        <span className="min-w-0 max-w-[150px] sm:max-w-none">
                          <span className="block font-medium truncate">{r.name}</span>
                          {/* Phones: quals sit under the name instead of a column */}
                          {r.quals.length > 0 && (
                            <span className="sm:hidden mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                              {r.quals.join(" · ")}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td
                      className="px-3 text-xs text-muted-foreground hidden md:table-cell"
                      style={{ paddingBlock: "var(--pad-row)" }}
                    >
                      {r.rank}
                    </td>
                    <td
                      className="px-3 hidden 2xl:table-cell"
                      style={{ paddingBlock: "var(--pad-row)" }}
                    >
                      {r.service_number ? (
                        <span className="font-mono text-xs text-muted-foreground">{r.service_number}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td
                      className="px-3 hidden md:table-cell"
                      style={{ paddingBlock: "var(--pad-row)" }}
                    >
                      {r.driver_lgv || r.driver_erd ? (
                        <div className="flex gap-1">
                          {r.driver_lgv && <Qual label="LGV" tone="blue" />}
                          {r.driver_erd && <Qual label="ERD" tone="blue" />}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 hidden sm:table-cell min-w-[110px]" style={{ paddingBlock: "var(--pad-row)" }}>
                      {r.quals.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.quals.map((q) => (
                            <Qual
                              key={q}
                              label={q}
                              tone={
                                q === "BA" ? "orange" :
                                q === "OIC" ? "purple" :
                                q === "DECON" || q === "HOOKLIFT" ? "amber" :
                                "default"
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4" style={{ paddingBlock: "var(--pad-row)" }}>
                      <span className="inline-flex flex-wrap items-center gap-1 whitespace-nowrap">
                        <StatusBadge status={r.status} />
                        {r.stage3 && <StatusBadge status={{ kind: "stage3", label: "Triggers hit" }} />}
                      </span>
                    </td>
                    {canLogSick && (
                      <td
                        className="px-2 sm:px-4 text-right"
                        style={{ paddingBlock: "var(--pad-row)" }}
                      >
                        {r.status.kind === "on_duty" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => openLogSickFor(r.id, r.name)}
                            aria-label={`Log ${r.name} sick`}
                          >
                            <Stethoscope className="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
                            <span className="hidden sm:inline">Log sick</span>
                          </Button>
                        ) : r.status.kind === "sick" ? (
                          r.absence_id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-950/20"
                              disabled={bookBackFit.isPending}
                              onClick={() => bookBackFit.mutate(r.absence_id!)}
                              title="Book this firefighter back fit and close the sickness"
                              aria-label={`Mark ${r.name} fit`}
                            >
                              <Heart className="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
                              <span className="hidden sm:inline">Mark fit</span>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">Booked off</span>
                          )
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Log Sick — shared with the People page. WC/CC only (gated by the
          caller rendering the Actions column). */}
      <LogSickDialog
        open={logSickOpen}
        onOpenChange={setLogSickOpen}
        person={logSickPerson}
      />
    </Card>
  );
}
