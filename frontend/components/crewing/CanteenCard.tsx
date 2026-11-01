import { createContext, useContext, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ChefHat, Plus, X } from "lucide-react";
import backend from "@/lib/backend";
import type { crewing } from "@/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Canteen duty on the crewing board (John, Nov 2026): one or two people per
// shift, anyone on the watch, and they still ride. Tick the chef's hat on a
// crewed name, or use this card — its suggestion is whoever has gone longest
// without canteen (the same fairness idea as the detachment rota).

type ShiftType = crewing.ShiftType;
const MAX = 2;

export function sinceLabel(date: string | null): string {
  if (!date) return "never";
  const d = differenceInCalendarDays(new Date(), parseISO(date));
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

/** Canteen for one shift + the watch's rota, with add/remove. */
export function useCanteen(watch: string, shiftDate: string, shiftType: ShiftType) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["canteen", watch, shiftDate, shiftType];
  const dutiesQ = useQuery({
    queryKey: key,
    queryFn: () => backend.crewing.listCanteen({ watch, shift_date: shiftDate, shift_type: shiftType }),
    enabled: !!watch,
  });
  const rotaQ = useQuery({
    queryKey: ["canteen-rota", watch],
    queryFn: () => backend.crewing.canteenRota({ watch }),
    enabled: !!watch,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["canteen-rota", watch] });
  };
  const add = useMutation({
    mutationFn: (userId: string) => backend.crewing.addCanteen({ watch, shift_date: shiftDate, shift_type: shiftType, user_id: userId }),
    onSuccess: refresh,
    onError: (e: unknown) =>
      toast({ title: "Couldn't add to canteen", description: e instanceof Error ? e.message : undefined, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => backend.crewing.removeCanteen(id),
    onSuccess: refresh,
    onError: () => toast({ title: "Couldn't take them off canteen", variant: "destructive" }),
  });
  const duties = dutiesQ.data?.duties ?? [];
  const byUser = new Map(duties.map((d) => [d.user_id, d.id]));
  const toggle = (userId: string) => {
    const id = byUser.get(userId);
    if (id) return remove.mutate(id);
    if (duties.length >= MAX) {
      toast({ title: `Canteen already has ${MAX}`, description: "Take someone off first." });
      return;
    }
    add.mutate(userId);
  };
  return { duties, byUser, rota: rotaQ.data?.members ?? [], add, remove, toggle, busy: add.isPending || remove.isPending };
}

/** Lets each crewed name on the board show / toggle its chef's hat. */
export const CanteenContext = createContext<{ byUser: Map<string, number>; toggle: (userId: string) => void; canEdit: boolean } | null>(null);

export function CanteenToggle({ userId }: { userId?: string | null }) {
  const ctx = useContext(CanteenContext);
  if (!ctx || !userId) return null;
  const on = ctx.byUser.has(userId);
  if (!ctx.canEdit && !on) return null;
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()} // don't start a drag
      onClick={(e) => { e.stopPropagation(); if (ctx.canEdit) ctx.toggle(userId); }}
      disabled={!ctx.canEdit}
      title={on ? "On canteen — tap to take off" : "Put on canteen"}
      aria-pressed={on}
      aria-label={on ? "On canteen" : "Put on canteen"}
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors",
        on
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "text-muted-foreground/40 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100",
      )}
    >
      <ChefHat className="h-3.5 w-3.5" />
    </button>
  );
}

export function CanteenCard({
  canteen, offDuty, canEdit,
}: {
  canteen: ReturnType<typeof useCanteen>;
  /** People who aren't working this shift → why (sick, leave, H4H…). */
  offDuty: Map<string, string>;
  canEdit: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const { duties, rota, add, remove, busy } = canteen;
  const lastOf = new Map(rota.map((m) => [m.user_id, m.last_date]));
  const free = rota.filter((m) => !offDuty.has(m.user_id) && !canteen.byUser.has(m.user_id));
  const next = free[0];

  return (
    <section className="rounded-xl border border-border/70 bg-card">
      <header className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-semibold">Canteen</h3>
          <span className="text-xs text-muted-foreground">· 1–2 per shift, still riding</span>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{duties.length}/{MAX}</span>
      </header>

      <div className="flex flex-wrap items-center gap-2 p-4">
        {duties.map((d) => (
          <span key={d.id} className="inline-flex items-center gap-2 rounded-full bg-amber-100 py-1 pl-3 pr-1 text-sm font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            <ChefHat className="h-3.5 w-3.5" />
            {d.user_name ?? "Unknown"}
            {canEdit && (
              <button
                onClick={() => remove.mutate(d.id)}
                disabled={busy}
                className="grid h-6 w-6 place-items-center rounded-full hover:bg-amber-200/70 dark:hover:bg-amber-800/50"
                aria-label={`Take ${d.user_name ?? "them"} off canteen`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}

        {canEdit && duties.length < MAX && (
          <>
            {next && (
              <button
                onClick={() => add.mutate(next.user_id)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-emerald-50/70 px-3 py-1 text-sm text-emerald-900 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                title="Longest since canteen"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="font-semibold">{next.name}</span>
                <span className="text-xs opacity-75">· last {sinceLabel(next.last_date)}</span>
              </button>
            )}
            <button
              onClick={() => setPicking(true)}
              className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            >
              {next ? "Other…" : "Choose…"}
            </button>
          </>
        )}
        {!duties.length && !canEdit && <span className="text-sm text-muted-foreground">Nobody on canteen yet.</span>}
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Canteen</DialogTitle>
            <DialogDescription>Longest since canteen first. Tap a name to put them on.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-0.5">
            {rota.map((m, i) => {
              const reason = offDuty.get(m.user_id);
              const already = canteen.byUser.has(m.user_id);
              return (
                <li key={m.user_id}>
                  <button
                    disabled={!!reason || already || busy}
                    onClick={() => { add.mutate(m.user_id); setPicking(false); }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left",
                      reason || already ? "cursor-not-allowed opacity-50" : "hover:bg-muted",
                    )}
                  >
                    <span className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      i === 0 && !reason && !already ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground",
                    )}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        Last canteen {sinceLabel(lastOf.get(m.user_id) ?? null)}
                        {m.recent_count > 0 && ` · ${m.recent_count} in 90 days`}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{already ? "On canteen" : reason ?? ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}
