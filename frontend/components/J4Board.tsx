import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { Check, CheckCircle2, Link2, Package, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { WatchDot } from "@/components/WatchBadge";
import { useIsCrewCommander } from "@/lib/rbac";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { boardGroups, kitMatches, outstanding, type BoardDefect, type BoardLine } from "@/lib/j4Board";
import { kitSections, whereKept } from "@/lib/kitList";
import type { appliance } from "@/client";

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

export default function J4Board() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = useIsCrewCommander(); // WC or CC
  const [view, setView] = useState<"board" | "cleared">("board");
  // The line being tied to an item on its appliance's kit list.
  const [linking, setLinking] = useState<BoardLine | null>(null);

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
              <div className="hidden grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_4rem_17rem] gap-3 border-b px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
                <span>Date</span>
                <span>Item and remarks</span>
                <span>Watch</span>
                <span>J7</span>
                <span className="text-right">{canManage ? "Update" : "Status"}</span>
              </div>
              <ul className="divide-y">
                {g.lines.map((line) => (
                  <Line
                    key={line.id}
                    line={line}
                    canManage={canManage}
                    busy={update.isPending}
                    onUpdate={(patch) => update.mutate({ id: line.id, ...patch })}
                    onLink={() => setLinking(line)}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      ))}

      <p className="text-xs text-muted-foreground">
        Anyone can add a line with "Add to the board". A Watch or Crew Commander ticks the J7, marks it ordered and clears it when the kit is back
        {canManage ? ", and can link a typed-in line to its item on the kit list so the J4 check starts that item as missing or defective." : "."}
      </p>

      <LinkKitDialog
        line={linking}
        // Kit that already has a line on the board (other than this one).
        taken={new Set(onBoard.filter((d) => d.equipment_item_id && d.id !== linking?.id).map((d) => d.equipment_item_id!))}
        onClose={() => setLinking(null)}
      />
    </div>
  );
}

/**
 * Ties a typed-in line to an item on its appliance's kit list (John, Nov
 * 2026). The J4 check only knows an item is on the board when its line is
 * tied to it; a line typed in by hand isn't until someone says which item.
 */
function LinkKitDialog({ line, taken, onClose }: { line: BoardLine | null; taken: Set<number>; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const applianceId = line?.applianceId ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["equipment", applianceId],
    queryFn: () => backend.appliance.listEquipment({ appliance_id: applianceId! }),
    enabled: applianceId !== null,
  });
  const kit = data?.items ?? [];

  const close = () => { setSearch(""); setPicked(null); onClose(); };

  const link = useMutation({
    mutationFn: (itemId: number) => backend.appliance.updateDefect(line!.id, { equipment_item_id: itemId }),
    onSuccess: (_d, itemId) => {
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      toast({ title: `Linked to ${kit.find((i) => i.id === itemId)?.name ?? "the kit item"}`, description: "The J4 check will start it as on the board." });
      close();
    },
    onError: (e: any) => toast({ title: "Couldn't link it", description: e?.message, variant: "destructive" }),
  });

  const q = search.trim().toLowerCase();
  const found = q ? kit.filter((i) => `${i.name} ${i.locker ?? ""} ${i.shelf ?? ""}`.toLowerCase().includes(q)) : kit;
  const likely = q || !line ? [] : kitMatches(line.typed || line.item, kit).slice(0, 4);
  const sections = kitSections(found);

  const row = (item: appliance.EquipmentItem, showWhere: boolean) => {
    const onBoard = taken.has(item.id);
    return (
      <li key={item.id}>
        <button
          type="button"
          role="radio"
          aria-checked={picked === item.id}
          disabled={onBoard}
          onClick={() => setPicked(item.id)}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors",
            picked === item.id ? "bg-foreground text-background" : "hover:bg-muted",
            onBoard && "cursor-not-allowed opacity-50 hover:bg-transparent",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span>
            {(showWhere || onBoard) && (
              <span className={cn("block text-xs", picked === item.id ? "text-background/80" : "text-muted-foreground")}>
                {[showWhere ? whereKept(item) : "", onBoard ? "already has a line on the board" : ""].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          {picked === item.id && <Check className="h-4 w-4 shrink-0" />}
        </button>
      </li>
    );
  };

  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto pb-0">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{line?.kit === "linked" ? "Change the kit item" : "Link to a kit item"}</DialogTitle>
          <DialogDescription>
            Pick the item on the kit list that "{line?.typed || line?.item}" is about. The J4 check will then start that item as on the board.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Find a kit item"
              placeholder="Find a kit item…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-9"
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : kit.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              This appliance has no kit list yet. Add its kit from the Appliances tab first.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Kit items" className="space-y-3">
              {likely.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Likely</h4>
                  <ul className="divide-y overflow-hidden rounded-lg border">{likely.map((i) => row(i, true))}</ul>
                </div>
              )}
              {sections.length === 0 && (
                <p className="px-1 py-4 text-sm text-muted-foreground">Nothing on the kit list matches "{search.trim()}".</p>
              )}
              {sections.map((section) => (
                <div key={section.key}>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.name}</h4>
                  <ul className="divide-y overflow-hidden rounded-lg border">
                    {section.shelves.flatMap((shelf) => shelf.items.map((i) => row(i, false)))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 -mx-6 flex-row justify-end gap-2 border-t bg-background px-6 py-3">
          <Button type="button" variant="outline" onClick={close}>Cancel</Button>
          <Button type="button" disabled={picked === null || link.isPending} onClick={() => picked !== null && link.mutate(picked)}>
            {link.isPending ? "Linking…" : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Line({
  line, canManage, busy, onUpdate, onLink,
}: {
  line: BoardLine;
  canManage: boolean;
  busy: boolean;
  onUpdate: (patch: { status?: "Open" | "Ordered" | "Resolved"; j7_raised?: boolean }) => void;
  onLink: () => void;
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
    <li className="px-4 py-3 md:grid md:grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_4rem_17rem] md:items-center md:gap-3">
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
        {/* A typed-in line isn't tied to the kit list until someone says which item it is. */}
        {canManage && !isCleared && line.kit && (
          <button
            type="button"
            onClick={onLink}
            className="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline md:min-h-7"
          >
            <Link2 className="h-3.5 w-3.5" />
            {line.kit === "linked" ? "Change kit item" : "Link to a kit item"}
          </button>
        )}
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
      <div className="hidden items-center justify-end gap-2 md:flex">
        {status}
        {actions}
      </div>
    </li>
  );
}
