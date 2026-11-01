import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Search, Upload } from "lucide-react";
import backend from "@/lib/backend";
import type { hydrants } from "@/client";
import { useAuth } from "@/App";
import { cn } from "@/lib/utils";
import { invalidateTargetViews } from "@/lib/targetsCache";
import { pace as paceOf } from "@/lib/quarters";
import { initialsOf } from "@/lib/taskUi";
import { readHydrantWorkbooks } from "@/lib/hydrantWorkbook";
import { ACTION_CODES, INSPECTION_CODES, NEEDS_COMMENT, isDefect, isUnable } from "@/lib/hydrantCodes";
import { PaceLines, PacePill } from "@/components/targets/TargetParts";
import { STATION_WATCHES } from "@/components/targets/StationComparison";
import { WatchDot } from "@/components/WatchBadge";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Hydrants (Nov 2026): the watch's hydrant route for the year, from the SP
// route sheets and the 15-year rota on the station board. One tick per
// hydrant records the usual result (1 Fully functional, 1 Tested, lid
// secured, no trip hazard); the drop-downs change it when something's wrong.
// The year and watch live in the URL (?year=2026&watch=Blue).

type RouteHydrant = hydrants.RouteHydrant;
type Inspection = hydrants.HydrantInspection;
type Filter = "all" | "todo" | "done" | "issues";

const FIRST_YEAR = 2019;
const thisYear = () => new Date().getFullYear();

function yearPace(year: number) {
  const now = new Date();
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const phase = now.getTime() < start ? "future" : now.getTime() >= end ? "past" : "now";
  const elapsed = phase === "now" ? (now.getTime() - start) / (end - start) : phase === "past" ? 1 : 0;
  return { phase, elapsed } as const;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function Hydrants() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const ownWatch = user?.watch_unit ?? "";
  const isManager = user?.role === "WC" || user?.role === "CC";
  const watch = (STATION_WATCHES as readonly string[]).find((w) => w === params.get("watch")) ?? ownWatch;
  const year = Math.min(Math.max(Number(params.get("year")) || thisYear(), FIRST_YEAR), thisYear() + 1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const select = (next: { watch?: string; year?: number }) => {
    const p = new URLSearchParams(params);
    const w = next.watch ?? watch;
    if (w && w !== ownWatch) p.set("watch", w); else p.delete("watch");
    const y = next.year ?? year;
    if (y !== thisYear()) p.set("year", String(y)); else p.delete("year");
    setParams(p, { replace: true });
  };

  const key = ["hydrants", "route", watch, year];
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => backend.hydrants.getHydrantRoute({ watch: watch || undefined, year }),
    enabled: !!watch,
  });

  // ── Saving: optimistic, so a tick lands at once on the street ──────────
  const patchCache = (id: number, inspection: Inspection | null) =>
    qc.setQueryData<hydrants.HydrantRouteResponse>(key, (old) => old && {
      ...old,
      routes: old.routes.map((r) => ({ ...r, hydrants: r.hydrants.map((h) => (h.id === id ? { ...h, inspection } : h)) })),
    });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["hydrants"] });
    invalidateTargetViews(qc);
  };
  const failed = (err: unknown) => {
    qc.invalidateQueries({ queryKey: key });
    toast({ title: "Couldn't save the hydrant", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
  };

  const save = useMutation({
    mutationFn: ({ h, patch }: { h: RouteHydrant; patch: hydrants.SaveHydrantInspectionRequest }) =>
      backend.hydrants.saveHydrantInspection(h.id, patch),
    onMutate: ({ h, patch }) => {
      const base: Inspection = h.inspection ?? {
        hydrant_id: h.id, year, watch, lid_ok: true, trip_hazard: false, inspection_codes: [1], action_codes: [1],
        comment: null, inspected_by: user?.id ?? "", inspected_by_name: user?.name ?? null, inspected_at: new Date().toISOString(),
      };
      patchCache(h.id, { ...base, ...(patch as Partial<Inspection>), year });
    },
    onSuccess: (saved, { h }) => patchCache(h.id, saved),
    onError: failed,
    onSettled: refresh,
  });

  const clear = useMutation({
    mutationFn: (h: RouteHydrant) => backend.hydrants.clearHydrantInspection(h.id, { year }),
    onMutate: (h) => patchCache(h.id, null),
    onError: failed,
    onSettled: refresh,
  });

  const setInUse = useMutation({
    mutationFn: ({ h, inUse }: { h: RouteHydrant; inUse: boolean }) => backend.hydrants.setHydrantInUse(h.id, { in_use: inUse }),
    onError: failed,
    onSettled: refresh,
  });

  // WC/CC: load or refresh the hydrant list from the SharePoint route workbooks.
  const fileInput = useRef<HTMLInputElement>(null);
  const importBooks = useMutation({
    mutationFn: async (files: File[]) => {
      const list = await readHydrantWorkbooks(files);
      if (list.length === 0) throw new Error("No route sheets found — pick the 'COG Hydrant Records' workbooks.");
      const res = await backend.hydrants.importHydrants({ hydrants: list });
      return { ...res, routes: new Set(list.map((h) => h.route)).size };
    },
    onSuccess: (r) => toast({ title: `Loaded ${r.created + r.updated} hydrants on ${r.routes} routes`, description: r.updated ? `${r.created} new, ${r.updated} updated. Ticks already made are kept.` : undefined }),
    onError: (err) => toast({ title: "Couldn't load the workbooks", description: err instanceof Error ? err.message : undefined, variant: "destructive" }),
    onSettled: refresh,
  });
  const loadButton = isManager && (
    <>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        aria-label="Route workbooks"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) importBooks.mutate(files);
        }}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={importBooks.isPending}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        <Upload className="h-4 w-4" /> {importBooks.isPending ? "Loading…" : data?.loaded ? "Update routes from workbooks" : "Load route workbooks"}
      </button>
    </>
  );

  const tick = (h: RouteHydrant) => {
    if (!h.inspection) {
      save.mutate({ h, patch: { year } });
      return;
    }
    const before = h.inspection;
    clear.mutate(h);
    toast({
      title: `Unticked #${h.seq} ${h.street}`,
      duration: 10_000,
      action: (
        <ToastAction altText="Undo" onClick={() => save.mutate({
          h: { ...h, inspection: null },
          patch: {
            year, lid_ok: before.lid_ok, trip_hazard: before.trip_hazard,
            inspection_codes: before.inspection_codes, action_codes: before.action_codes, comment: before.comment,
          },
        })}>Undo</ToastAction>
      ),
    });
  };

  // ── What's shown ───────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const routes = useMemo(() => (data?.routes ?? []).map((r) => ({
    ...r,
    shown: r.hydrants.filter((h) => {
      if (q && ![h.street, h.location ?? "", h.ref ?? "", `#${h.seq}`].some((s) => s.toLowerCase().includes(q))) return false;
      const i = h.inspection;
      if (filter === "todo") return h.in_use && !i;
      if (filter === "done") return !!i;
      if (filter === "issues") return !!i && (isDefect(i.inspection_codes) || isUnable(i.inspection_codes) || i.lid_ok === false || i.trip_hazard === true);
      return true;
    }),
  })), [data, q, filter]);

  const total = data?.total ?? 0;
  const done = data?.done ?? 0;
  const yp = yearPace(year);
  const p = paceOf(done, total, yp.elapsed, yp.phase);
  const notInUse = (data?.routes ?? []).reduce((n, r) => n + r.hydrants.filter((h) => !h.in_use).length, 0);
  const canEdit = !!data?.can_edit && year <= thisYear();
  const otherWatch = watch !== ownWatch;

  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="eyebrow">
            <Link to="/targets" className="hover:underline">Targets</Link> · {watch ? `${watch} Watch` : "No watch set"}
            {data && ` · Year ${data.cycle_year} of 15`}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Hydrants</h1>
            <div className="flex items-center gap-1" role="group" aria-label="Year">
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                aria-label="Previous year"
                disabled={year <= FIRST_YEAR}
                onClick={() => select({ year: year - 1 })}
              ><ChevronLeft className="h-4 w-4" /></button>
              <span className="w-14 text-center font-mono text-sm font-semibold tabular-nums">{year}</span>
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                aria-label="Next year"
                disabled={year >= thisYear() + 1}
                onClick={() => select({ year: year + 1 })}
              ><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Watch">
          {STATION_WATCHES.map((w) => (
            <button
              key={w}
              onClick={() => select({ watch: w })}
              aria-pressed={w === watch}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                w === watch ? "border-foreground/70 bg-foreground text-background" : "border-border hover:bg-muted",
              )}
            >
              <WatchDot watch={w} /> {w}{w === ownWatch && w !== watch ? " (yours)" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* ── This year's route and progress ─────────────────────────────── */}
      <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">Couldn't load the hydrant route.</p>
        ) : !data.loaded ? (
          <div className="flex flex-col items-start gap-3 text-sm">
            <p className="text-muted-foreground">
              The hydrant routes haven't been loaded yet.
              {isManager ? " Pick the four 'COG Hydrant Records' workbooks (1-10, 11-20, 21-30, 31-40) from SharePoint." : " A WC or CC loads them from the route workbooks."}
            </p>
            {loadButton}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-mono text-3xl font-semibold tabular-nums leading-none">
                {done}<span className="text-muted-foreground">/{total}</span>
              </span>
              <div className="min-w-0">
                <div className="font-semibold">{data.label}</div>
                <div className="text-xs text-muted-foreground">
                  {watch} Watch's route for {year}
                  {otherWatch && " · read only"}
                </div>
              </div>
              <span className="ml-auto"><PacePill state={p.state} /></span>
            </div>
            <div className="relative h-2.5 rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Hydrants inspected">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full transition-[width]", p.state === "behind" || p.state === "late" ? "bg-amber-500" : p.state === "done" ? "bg-emerald-500" : "bg-brand")}
                style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
              />
              {yp.phase === "now" && (
                <span className="absolute -inset-y-1 w-0.5 rounded bg-foreground" style={{ left: `calc(${yp.elapsed * 100}% - 1px)` }} title={`${Math.round(yp.elapsed * 100)}% of ${year} gone`} />
              )}
            </div>
            <PaceLines pace={p} noun="hydrants" shifts={null} watch={watch} />
            {(data.defects > 0 || data.unable > 0 || notInUse > 0) && (
              <div className="flex flex-wrap gap-1.5 text-xs font-medium">
                {data.defects > 0 && (
                  <button onClick={() => setFilter("issues")} className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> {data.defects} unsatisfactory
                  </button>
                )}
                {data.unable > 0 && (
                  <button onClick={() => setFilter("issues")} className="rounded-lg bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    {data.unable} couldn't be inspected
                  </button>
                )}
                {notInUse > 0 && <span className="rounded-lg bg-muted px-2 py-1 text-muted-foreground">{notInUse} not in use (not counted)</span>}
              </div>
            )}
          </div>
        )}
      </section>

      {data?.loaded && (
        <>
          {/* ── Search and filter ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Street, location or ID"
                aria-label="Search hydrants"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
              />
            </label>
            <div className="seg w-full sm:w-[300px]" role="group" aria-label="Show">
              {([["all", "All"], ["todo", "To do"], ["done", "Done"], ["issues", "Issues"]] as [Filter, string][]).map(([k, label]) => (
                <button key={k} data-on={filter === k} onClick={() => setFilter(k)}>{label}</button>
              ))}
            </div>
          </div>

          {/* ── The routes ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {routes.map((r) => {
              const live = r.hydrants.filter((h) => h.in_use);
              const rDone = live.filter((h) => h.inspection).length;
              const open = !closed.has(r.route);
              if (r.shown.length === 0 && (q || filter !== "all")) return null;
              return (
                <section key={r.route} className="rounded-2xl border border-border/70 bg-card">
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    aria-expanded={open}
                    onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(r.route)) n.delete(r.route); else n.add(r.route); return n; })}
                  >
                    <span className="shrink-0 whitespace-nowrap font-semibold">SP {r.route}</span>
                    <span className="min-w-0 truncate text-xs text-muted-foreground">{[...new Set(live.map((h) => h.street))].slice(0, 3).join(", ")}{new Set(live.map((h) => h.street)).size > 3 ? "…" : ""}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {rDone === live.length && live.length > 0 ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">All {live.length} done</span> : `${rDone}/${live.length}`}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
                  </button>
                  {open && (
                    <ul className="flex flex-col gap-1.5 border-t border-border/60 p-2 sm:p-3">
                      {r.shown.map((h) => (
                        <HydrantRow
                          key={h.id}
                          h={h}
                          canEdit={canEdit}
                          isManager={isManager}
                          onTick={() => tick(h)}
                          onSave={(patch) => save.mutate({ h, patch: { year, ...patch } })}
                          onInUse={(inUse) => setInUse.mutate({ h, inUse })}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          {loadButton && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {loadButton}
              <span>Re-load the SharePoint workbooks when a route changes; ticks are kept.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HydrantRow({
  h, canEdit, isManager, onTick, onSave, onInUse,
}: {
  h: RouteHydrant;
  canEdit: boolean;
  isManager: boolean;
  onTick: () => void;
  onSave: (patch: Omit<hydrants.SaveHydrantInspectionRequest, "year">) => void;
  onInUse: (inUse: boolean) => void;
}) {
  const i = h.inspection;
  const issue = !!i && (isDefect(i.inspection_codes) || isUnable(i.inspection_codes) || i.lid_ok === false || i.trip_hazard === true);
  const wantsComment = !!i && i.inspection_codes.some((c) => NEEDS_COMMENT.includes(c)) && !i.comment;
  const details = [h.main_size && `${h.main_size}mm`, h.surface, h.marker, h.dist && `dist ${h.dist}`].filter(Boolean).join(" · ");

  return (
    <li
      className={cn(
        "rounded-xl px-2 py-2 sm:px-3",
        !h.in_use && "opacity-60",
        issue ? "bg-amber-50 ring-1 ring-amber-300/70 dark:bg-amber-500/10 dark:ring-amber-500/30" : i ? "bg-muted/40" : "",
      )}
    >
      <div className="flex items-start gap-3">
        {h.in_use ? (
          <button
            type="button"
            onClick={onTick}
            disabled={!canEdit}
            aria-pressed={!!i}
            aria-label={i ? `Untick hydrant ${h.seq}, ${h.street}` : `Tick hydrant ${h.seq}, ${h.street} as inspected`}
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 transition-colors sm:h-9 sm:w-9",
              i ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 bg-background",
              canEdit ? (i ? "hover:bg-emerald-600" : "hover:border-emerald-500") : "cursor-default",
            )}
          >
            {i && <Check className="h-5 w-5" strokeWidth={3} />}
          </button>
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center text-[10px] font-semibold uppercase text-muted-foreground sm:h-9 sm:w-9">off</span>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-xs text-muted-foreground">#{h.seq}</span>
            <span className={cn("font-medium", !h.in_use && "line-through")}>{h.street}</span>
            {h.ref && <span className="font-mono text-[11px] text-muted-foreground">ID {h.ref}</span>}
            {!h.in_use && <span className="text-[11px] font-medium text-muted-foreground">Not in use</span>}
          </div>
          {h.location && <div className="text-sm text-muted-foreground">{h.location}</div>}
          {details && <div className="text-[11px] text-muted-foreground">{details}</div>}
        </div>
        {i && (
          <span className="shrink-0 pt-1 font-mono text-[11px] text-muted-foreground" title={`Ticked by ${i.inspected_by_name ?? "someone"}`}>
            {initialsOf(i.inspected_by_name)} · {shortDate(i.inspected_at)}
          </span>
        )}
        {isManager && (
          <DropdownMenu>
            <DropdownMenuTrigger className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label={`More for hydrant ${h.seq}`}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onInUse(!h.in_use)}>
                {h.in_use ? "Mark not in use (abandoned / removed)" : "Mark back in use"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {i && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:ml-12 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] sm:items-center">
          <CodePicker
            label="Inspection"
            codes={i.inspection_codes}
            names={INSPECTION_CODES}
            disabled={!canEdit}
            problem={isDefect(i.inspection_codes) || isUnable(i.inspection_codes)}
            onChange={(codes, picked) => onSave({ inspection_codes: withoutContradictions(codes, picked) })}
          />
          <CodePicker label="Action" codes={i.action_codes} names={ACTION_CODES} disabled={!canEdit} onChange={(codes) => onSave({ action_codes: codes })} />
          <YesNo label="Lid secured" value={i.lid_ok} problemWhen={false} disabled={!canEdit} onChange={(v) => onSave({ lid_ok: v })} />
          <YesNo label="Trip hazard" value={i.trip_hazard} problemWhen={true} disabled={!canEdit} onChange={(v) => onSave({ trip_hazard: v })} />
          <CommentBox
            key={`${h.id}-${i.comment ?? ""}`}
            initial={i.comment ?? ""}
            wanted={wantsComment}
            disabled={!canEdit}
            onSave={(comment) => onSave({ comment })}
          />
        </div>
      )}
    </li>
  );
}

/** "1 Fully functional" can't stand beside a problem code: picking one drops the other. */
function withoutContradictions(codes: number[], picked: number): number[] {
  const problem = (c: number) => (c >= 2 && c <= 5) || c >= 7;
  if (picked === 1) return codes.filter((c) => !problem(c));
  if (problem(picked)) return codes.filter((c) => c !== 1);
  return codes;
}

/** A drop-down of codes; more than one can be ticked, as the sheet allows. */
function CodePicker({
  label, codes, names, disabled, problem, onChange,
}: {
  label: string;
  codes: number[];
  names: Record<number, string>;
  disabled: boolean;
  problem?: boolean;
  onChange: (codes: number[], picked: number) => void;
}) {
  const summary = codes.length === 0 ? "Pick a code" : `${codes[0]} · ${names[codes[0]]}${codes.length > 1 ? ` +${codes.length - 1}` : ""}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "col-span-2 flex h-10 min-w-0 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-left text-sm disabled:cursor-default sm:col-span-1 sm:h-9",
          problem ? "border-amber-400 text-amber-900 dark:border-amber-500/60 dark:text-amber-200" : "border-border",
        )}
      >
        <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{summary}</span>
        {!disabled && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60vh] w-80 overflow-y-auto">
        <DropdownMenuLabel>{label} code(s)</DropdownMenuLabel>
        {Object.entries(names).map(([n, name]) => {
          const code = Number(n);
          const on = codes.includes(code);
          return (
            <DropdownMenuCheckboxItem
              key={code}
              checked={on}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => {
                const next = on ? codes.filter((c) => c !== code) : [...codes, code].sort((a, b) => a - b);
                if (next.length) onChange(next, code);
              }}
            >
              <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{code}</span> {name}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function YesNo({
  label, value, problemWhen, disabled, onChange,
}: {
  label: string;
  value: boolean | null;
  problemWhen: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const problem = value === problemWhen;
  return (
    <div className="flex items-center justify-between gap-2 sm:justify-start" role="group" aria-label={label}>
      <span className={cn("text-xs", problem ? "font-semibold text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>{label}</span>
      <div className="seg" style={{ width: 76 }}>
        <button data-on={value === true} disabled={disabled} onClick={() => onChange(true)}>Y</button>
        <button data-on={value === false} disabled={disabled} onClick={() => onChange(false)}>N</button>
      </div>
    </div>
  );
}

function CommentBox({ initial, wanted, disabled, onSave }: { initial: string; wanted: boolean; disabled: boolean; onSave: (c: string | null) => void }) {
  const [text, setText] = useState(initial);
  const commit = () => { if (text.trim() !== initial.trim()) onSave(text.trim() || null); };
  return (
    <input
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      placeholder={wanted ? "Add a comment — this code needs one" : "Comment (optional)"}
      aria-label="Comment"
      maxLength={500}
      className={cn(
        "col-span-2 h-10 rounded-lg border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40 sm:col-span-4 sm:h-9",
        wanted ? "border-amber-400 placeholder:text-amber-700 dark:placeholder:text-amber-300" : "border-border",
      )}
    />
  );
}
