import { useEffect, useMemo, useState } from "react";
import type { crewing } from "@/client";
import { cn } from "@/lib/utils";
import { qualifiesFor, type SeatRole } from "@/lib/autoCrew";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Search, UserPlus } from "lucide-react";

type RosterMember = crewing.RosterMember;

// Who should sit in this seat? One tap assigns. Qualified people first;
// people without the seat's qualification next (with a warning — acting up
// happens, so it isn't blocked); then everyone who can't ride, with why
// (already on a pump, off sick, H4H…). External / change of shift at the
// bottom. Replaces the old dropdown + Assign button.

const QUAL: Record<SeatRole, string> = { oic: "OIC", driver: "LGV", ba: "BA", baeco: "BA" };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function Quals({ m }: { m: RosterMember }) {
  const q = [m.oic && "OIC", m.driver_lgv && "LGV", m.ba && "BA"].filter(Boolean) as string[];
  if (!q.length) return null;
  return <span className="font-mono text-[10px] text-muted-foreground">{q.join(" · ")}</span>;
}

export function PersonPicker({
  open, title, role, roster, unavailable, suggestedId, busy, onPick, onExternal, onClose,
}: {
  open: boolean;
  title: string;
  role: SeatRole;
  roster: RosterMember[];
  /** People who can't take this seat → why (e.g. "On B10P2 · BA1", "Off sick"). */
  unavailable: Map<string, string>;
  suggestedId?: string;
  busy?: boolean;
  onPick: (userId: string) => void;
  onExternal: (name: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [ext, setExt] = useState("");
  useEffect(() => { if (open) { setQ(""); setExt(""); } }, [open]);

  const { qualified, other, away } = useMemo(() => {
    const match = (m: RosterMember) => !q || m.name.toLowerCase().includes(q.toLowerCase());
    const free = roster.filter((m) => !unavailable.has(m.id) && match(m));
    const byName = (a: RosterMember, b: RosterMember) =>
      a.id === suggestedId ? -1 : b.id === suggestedId ? 1 : a.name.localeCompare(b.name);
    return {
      qualified: free.filter((m) => qualifiesFor(m, role)).sort(byName),
      other: free.filter((m) => !qualifiesFor(m, role)).sort(byName),
      away: roster.filter((m) => unavailable.has(m.id) && match(m)).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [roster, unavailable, q, role, suggestedId]);

  const Row = ({ m, warn, reason }: { m: RosterMember; warn?: boolean; reason?: string }) => (
    <li>
      <button
        type="button"
        disabled={!!reason || busy}
        onClick={() => onPick(m.id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
          reason ? "cursor-not-allowed opacity-50" : "hover:bg-muted active:bg-muted",
        )}
      >
        <span className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
          m.id === suggestedId ? "bg-foreground text-background" : "bg-muted text-foreground",
        )}>
          {initials(m.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{m.name}</span>
            {m.id === suggestedId && (
              <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                Suggested
              </span>
            )}
          </span>
          <span className="flex items-center gap-2">
            <span className="truncate text-xs text-muted-foreground">{m.rank || m.system_role}</span>
            <Quals m={m} />
          </span>
        </span>
        {warn && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> No {QUAL[role]}
          </span>
        )}
        {reason && <span className="shrink-0 text-[11px] text-muted-foreground">{reason}</span>}
      </button>
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-3 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="space-y-1 px-5 pt-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Needs {QUAL[role]}. Tap someone to put them in this seat.</DialogDescription>
        </DialogHeader>
        <div className="relative px-5">
          <Search className="pointer-events-none absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the watch" className="h-10 pl-9" />
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-2">
          {qualified.length > 0 && (
            <section>
              <div className="eyebrow px-2.5 pb-1">{QUAL[role]} qualified</div>
              <ul>{qualified.map((m) => <Row key={m.id} m={m} />)}</ul>
            </section>
          )}
          {other.length > 0 && (
            <section>
              <div className="eyebrow px-2.5 pb-1">Not {QUAL[role]} qualified</div>
              <ul>{other.map((m) => <Row key={m.id} m={m} warn />)}</ul>
            </section>
          )}
          {away.length > 0 && (
            <section>
              <div className="eyebrow px-2.5 pb-1">Can't ride this shift</div>
              <ul>{away.map((m) => <Row key={m.id} m={m} reason={unavailable.get(m.id)} />)}</ul>
            </section>
          )}
          {!qualified.length && !other.length && !away.length && (
            <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">Nobody on the watch matches “{q}”.</p>
          )}
        </div>
        <form
          className="flex items-center gap-2 border-t border-border/70 bg-muted/30 px-5 py-3"
          onSubmit={(e) => { e.preventDefault(); if (ext.trim()) onExternal(ext.trim()); }}
        >
          <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input value={ext} onChange={(e) => setExt(e.target.value)} placeholder="External / change of shift name" className="h-9 flex-1" />
          <Button type="submit" size="sm" variant="outline" disabled={!ext.trim() || busy}>Add</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
