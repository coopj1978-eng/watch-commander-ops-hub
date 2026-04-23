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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, ChevronRight, Stethoscope } from "lucide-react";

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
//   Stage 3 trigger → "STAGE 3"  (red)
//   Sickness absence today → "Sick"
//   Non-sickness absence today → "Leave"
//   Otherwise → "On duty"
//
// This is deliberately a READ-ONLY table. Editing crew is still done on the
// Crewing board (/handover) with drag-and-drop — this component is the
// at-a-glance view an incoming WC wants to scan.
// ──────────────────────────────────────────────────────────────────────────────

type Status =
  | { kind: "stage3"; label: "Stage 3" }
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
      {status.kind === "stage3" ? (
        <span className="font-mono tracking-wide">STAGE 3</span>
      ) : (
        status.label
      )}
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
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 text-[9px] font-mono font-semibold text-white shrink-0"
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

export function CrewOnWatchTable() {
  const { user } = useAuth();
  const watch = user?.watch_unit ?? "";
  const today = new Date().toISOString().split("T")[0];
  const queryClient = useQueryClient();
  const canLogSick = useIsCrewCommander(); // WC or CC

  // ── Log Sick dialog state ────────────────────────────────────────────────
  // Mirrors the People page pattern exactly — same endpoint, same required
  // eForm-confirmed gate, same cache invalidations. Kept local here so
  // nothing on /people changes; if this pattern lands in a third place we
  // should extract a shared LogSickDialog component.
  const [logSickOpen, setLogSickOpen] = useState(false);
  const [logSickPerson, setLogSickPerson] = useState<{ id: string; name: string } | null>(null);
  const [logSickReason, setLogSickReason] = useState("");
  const [logSickEformConfirmed, setLogSickEformConfirmed] = useState(false);

  const logSickMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      return await backend.absence.create({
        user_id: userId,
        type: "sickness",
        start_date: today,
        end_date: today,
        reason: logSickReason || "Sick booking logged via Watch Commander Ops Hub",
        evidence_urls: [],
      });
    },
    onSuccess: () => {
      // Invalidate every query that surfaces today's sickness so dashboards
      // + alert banners refresh immediately. Keys chosen to match the
      // invalidations on the People page.
      queryClient.invalidateQueries({ queryKey: ["absences", "sick-today"] });
      queryClient.invalidateQueries({ queryKey: ["wc-absences-today"] });
      queryClient.invalidateQueries({ queryKey: ["absences-today-sick"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setLogSickOpen(false);
      setLogSickPerson(null);
      setLogSickReason("");
      setLogSickEformConfirmed(false);
    },
  });

  const openLogSickFor = (id: string, name: string) => {
    logSickMutation.reset();
    setLogSickPerson({ id, name });
    setLogSickOpen(true);
  };

  const closeLogSick = () => {
    setLogSickOpen(false);
    setLogSickPerson(null);
    setLogSickReason("");
    setLogSickEformConfirmed(false);
    logSickMutation.reset();
  };

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

  const absencesQ = useQuery({
    queryKey: ["wc-absences-today"],
    queryFn: async () =>
      backend.absence.list({
        status: "approved",
        start_date: today,
        end_date: today,
        limit: 200,
      }),
  });

  const isLoading = rosterQ.isLoading || profilesQ.isLoading || absencesQ.isLoading;

  // ── Join and derive ───────────────────────────────────────────────────────
  const members = rosterQ.data?.members ?? [];
  const profiles = profilesQ.data?.profiles ?? [];
  const absences = absencesQ.data?.absences ?? [];

  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));
  const absenceByUser = new Map(absences.map((a) => [a.firefighter_id, a]));

  const rows = members.map((m) => {
    const profile = profileByUser.get(m.id);
    const absence = absenceByUser.get(m.id);

    let status: Status;
    if (profile?.trigger_stage === "Stage3") {
      status = { kind: "stage3", label: "Stage 3" };
    } else if (absence?.type === "sickness") {
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

  return (
    <Card className="border-t-2 border-t-indigo-500">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
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
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-2">Name</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 hidden md:table-cell">Rank</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 hidden lg:table-cell">Service #</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 hidden md:table-cell">Driver</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2">Quals</th>
                  <th className="text-left font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-2">Status</th>
                  {canLogSick && (
                    <th className="text-right font-medium text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-2 hidden sm:table-cell w-28">
                      Actions
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
                    <td className="px-4 py-[var(--pad-row)]">
                      <Link
                        to={`/people/${r.id}`}
                        className="inline-flex items-center gap-2.5 min-w-0 hover:text-primary transition-colors"
                      >
                        <Avatar name={r.name} />
                        <span className="font-medium truncate">{r.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-[var(--pad-row)] text-xs text-muted-foreground hidden md:table-cell">
                      {r.rank}
                    </td>
                    <td className="px-3 py-[var(--pad-row)] hidden lg:table-cell">
                      {r.service_number ? (
                        <span className="font-mono text-xs text-muted-foreground">{r.service_number}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-[var(--pad-row)] hidden md:table-cell">
                      {r.driver_lgv || r.driver_erd ? (
                        <div className="flex gap-1">
                          {r.driver_lgv && <Qual label="LGV" tone="blue" />}
                          {r.driver_erd && <Qual label="ERD" tone="blue" />}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-[var(--pad-row)]">
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
                    <td className="px-4 py-[var(--pad-row)]">
                      <StatusBadge status={r.status} />
                    </td>
                    {canLogSick && (
                      <td className="px-4 py-[var(--pad-row)] text-right hidden sm:table-cell">
                        {r.status.kind === "on_duty" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => openLogSickFor(r.id, r.name)}
                          >
                            <Stethoscope className="h-3 w-3 mr-1" />
                            Log sick
                          </Button>
                        ) : r.status.kind === "sick" ? (
                          <span className="text-[11px] text-muted-foreground italic">Booked off</span>
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

      {/* ── Log Sick dialog ─────────────────────────────────────────────
          Mirror of the People page dialog, same endpoint, same required
          eForm confirmation gate. WC/CC only (gated by the caller
          rendering the Actions column). */}
      <Dialog
        open={logSickOpen}
        onOpenChange={(open) => { if (!open) closeLogSick(); }}
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                Firefighter
              </p>
              <p className="font-semibold">{logSickPerson?.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                Date
              </p>
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
              <Label htmlFor="crew-sick-reason" className="text-sm font-medium">
                Notes{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="crew-sick-reason"
                placeholder="Any additional notes about this sick booking..."
                className="mt-1.5 resize-none"
                rows={3}
                value={logSickReason}
                onChange={(e) => setLogSickReason(e.target.value)}
              />
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
              <Checkbox
                id="crew-eform-confirmed"
                checked={logSickEformConfirmed}
                onCheckedChange={(checked) => setLogSickEformConfirmed(!!checked)}
                className="mt-0.5"
              />
              <label htmlFor="crew-eform-confirmed" className="text-sm cursor-pointer leading-snug">
                <span className="font-medium">eForm submitted to central staffing</span>
                <span className="block text-muted-foreground text-xs mt-0.5">
                  Confirm the sickness eForm has been completed and submitted before logging
                </span>
              </label>
            </div>
            {logSickMutation.isError && (
              <p className="text-sm text-red-600">
                Failed to log sick booking. Please try again.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeLogSick}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={
                !logSickEformConfirmed ||
                logSickMutation.isPending ||
                !logSickPerson
              }
              onClick={() => {
                if (logSickPerson) logSickMutation.mutate({ userId: logSickPerson.id });
              }}
            >
              {logSickMutation.isPending ? "Logging..." : "Confirm Sick Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
