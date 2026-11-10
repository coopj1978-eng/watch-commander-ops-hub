import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { Check, CheckCircle2, Package, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { WatchDot } from "@/components/WatchBadge";
import { useIsCrewCommander } from "@/lib/rbac";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { boardGroups, outstanding, type BoardDefect, type BoardLine } from "@/lib/j4Board";

// ──────────────────────────────────────────────────────────────────────────────
// J4Board — the whiteboard in the office, in the app (John, Nov 2026).
//
// One block per appliance (an empty one still shows, as on the wall), then the
// station. Each line: date · item · remarks · watch · J7. Everyone on station
// can read it and add to it. A WC/CC ticks the J7, marks a line ordered, and
// clears it when the kit is back.
// ──────────────────────────────────────────────────────────────────────────────

/** Every line, cleared ones included — the page header and the cards read the same list. */
export function useBoardDefects() {
  return useQuery({
    queryKey: ["defects", "board"],
    queryFn: async () => (await backend.appliance.listDefects({})).defects as unknown as BoardDefect[],
  });
}

export default function J4Board({ onAdd }: { onAdd: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = useIsCrewCommander(); // WC or CC
  const [view, setView] = useState<"board" | "cleared">("board");

  const { data: appliancesData, isLoading: loadingAppliances } = useQuery({
    queryKey: ["appliances"],
    queryFn: () => backend.appliance.listAppliances({}),
  });
  const { data: defects = [], isLoading: loadingDefects } = useBoardDefects();

  const onBoard = defects.filter(outstanding);
  const cleared = defects.filter((d) => !outstanding(d));
  const groups = useMemo(
    () => boardGroups(appliancesData?.appliances ?? [], view === "board" ? onBoard : cleared),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appliancesData, defects, view],
  );
  // Cleared: only the blocks with something in them.
  const shown = view === "board" ? groups : groups.filter((g) => g.lines.length > 0);

  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: number; status?: "Open" | "Ordered" | "Resolved"; j7_raised?: boolean }) =>
      backend.appliance.updateDefect(id, patch),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      toast({
        title:
          vars.status === "Resolved" ? "Cleared off the board"
          : vars.status === "Ordered" ? "Marked as ordered"
          : vars.status === "Open" ? "Back on the board"
          : vars.j7_raised ? "J7 ticked" : "J7 tick removed",
      });
    },
    onError: (e: any) => toast({ title: "Couldn't update the board", description: e?.message, variant: "destructive" }),
  });

  if (loadingAppliances || loadingDefects) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Which lines" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          {([["board", `On the board${onBoard.length ? ` · ${onBoard.length}` : ""}`], ["cleared", "Cleared"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-medium transition-colors",
                view === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button onClick={onAdd} className="h-11 gap-2 bg-brand text-brand-foreground hover:bg-brand/90 sm:h-9">
          <Plus className="h-4 w-4" />
          Add to the board
        </Button>
      </div>

      {view === "cleared" && shown.length === 0 && (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          Nothing has been cleared off the board yet.
        </div>
      )}

      {shown.map((g) => (
        <section key={g.key} aria-label={`${g.heading} board`} className="overflow-hidden rounded-xl border bg-card">
          <header className="flex items-baseline justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
            <h3 className="min-w-0 truncate text-sm font-semibold">
              {g.heading}
              <span className="ml-2 font-normal text-muted-foreground">{g.sub}</span>
            </h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {g.lines.length === 0 ? "Nothing outstanding" : `${g.lines.length} ${g.lines.length === 1 ? "line" : "lines"}`}
            </span>
          </header>

          {g.lines.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600/70" />
              All kit accounted for.
            </p>
          ) : (
            <>
              {/* Column heads, as on the wall (wide screens only). */}
              <div className="hidden grid-cols-[6.5rem_minmax(0,1fr)_6rem_4rem_auto] gap-3 border-b px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
                <span>Date</span>
                <span>Item and remarks</span>
                <span>Watch</span>
                <span>J7</span>
                <span className="min-w-[11rem] text-right">{canManage ? "Update" : "Status"}</span>
              </div>
              <ul className="divide-y">
                {g.lines.map((line) => (
                  <Line
                    key={line.id}
                    line={line}
                    canManage={canManage}
                    busy={update.isPending}
                    onUpdate={(patch) => update.mutate({ id: line.id, ...patch })}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      ))}

      <p className="text-xs text-muted-foreground">
        Anyone can add a line. A Watch or Crew Commander ticks the J7, marks it ordered and clears it when the kit is back.
      </p>
    </div>
  );
}

function Line({
  line, canManage, busy, onUpdate,
}: {
  line: BoardLine;
  canManage: boolean;
  busy: boolean;
  onUpdate: (patch: { status?: "Open" | "Ordered" | "Resolved"; j7_raised?: boolean }) => void;
}) {
  const date = new Date(line.date);
  const days = differenceInDays(new Date(), date);
  const isCleared = line.status === "Resolved";

  const status = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        line.status === "Open" && "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
        line.status === "Ordered" && "bg-muted text-foreground",
        isCleared && "bg-muted text-muted-foreground",
      )}
    >
      {line.status === "Ordered" && <Package className="h-3 w-3" />}
      {isCleared && <CheckCircle2 className="h-3 w-3" />}
      {line.status === "Open" ? "Outstanding" : line.status === "Ordered" ? "Ordered" : "Cleared"}
    </span>
  );

  const j7 = canManage && !isCleared ? (
    <button
      type="button"
      role="switch"
      aria-checked={line.j7}
      aria-label={`J7 for ${line.item}`}
      disabled={busy}
      onClick={() => onUpdate({ j7_raised: !line.j7 })}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors md:h-8",
        line.j7 ? "border-transparent bg-foreground text-background" : "border-dashed text-muted-foreground hover:border-solid hover:text-foreground",
      )}
    >
      {line.j7 && <Check className="h-3.5 w-3.5" />}
      J7
    </button>
  ) : (
    <span className={cn("inline-flex items-center gap-1 text-xs", line.j7 ? "font-medium text-foreground" : "text-muted-foreground")}>
      {line.j7 ? <><Check className="h-3.5 w-3.5" /> J7 in</> : "No J7"}
    </span>
  );

  const watch = line.watch ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
      <WatchDot watch={line.watch} size="sm" />
      {line.watch}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  );

  const actions = canManage && (
    <div className="flex flex-wrap gap-1.5 md:justify-end">
      {line.status === "Open" && (
        <Button size="sm" variant="outline" className="h-9 gap-1 text-xs md:h-8" disabled={busy} onClick={() => onUpdate({ status: "Ordered" })}>
          <Package className="h-3.5 w-3.5" /> Ordered
        </Button>
      )}
      {!isCleared && (
        <Button size="sm" variant="outline" className="h-9 gap-1 text-xs md:h-8" disabled={busy} onClick={() => onUpdate({ status: "Resolved" })}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
      {isCleared && (
        <Button size="sm" variant="ghost" className="h-9 gap-1 text-xs text-muted-foreground md:h-8" disabled={busy} onClick={() => onUpdate({ status: "Open" })}>
          <RotateCcw className="h-3.5 w-3.5" /> Put back
        </Button>
      )}
    </div>
  );

  return (
    <li className="px-4 py-3 md:grid md:grid-cols-[6.5rem_minmax(0,1fr)_6rem_4rem_auto] md:items-center md:gap-3">
      {/* Date */}
      <div className="hidden text-sm tabular-nums md:block">
        {format(date, "d MMM yy")}
        {line.overdue && <span className="block text-xs font-medium text-red-600 dark:text-red-400">{days} days</span>}
      </div>

      {/* Item and remarks */}
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("min-w-0 break-words text-sm font-semibold", isCleared && "text-muted-foreground line-through")}>{line.item}</p>
          <span className="shrink-0 md:hidden">{status}</span>
        </div>
        {line.remarks && <p className="mt-0.5 break-words text-sm text-muted-foreground">{line.remarks}</p>}
        {/* Phone: date, watch and J7 on one line under the item. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 md:hidden">
          <span className="text-xs tabular-nums text-muted-foreground">
            {format(date, "d MMM yy")}
            {line.overdue && <span className="ml-1 font-medium text-red-600 dark:text-red-400">· {days} days</span>}
          </span>
          {watch}
          {j7}
        </div>
        {actions && <div className="mt-2 md:hidden">{actions}</div>}
      </div>

      <div className="hidden md:block">{watch}</div>
      <div className="hidden md:block">{j7}</div>
      <div className="hidden min-w-[11rem] items-center justify-end gap-2 md:flex">
        {status}
        {actions}
      </div>
    </li>
  );
}
