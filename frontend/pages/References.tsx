import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil } from "lucide-react";
import backend from "@/lib/backend";
import type { references } from "@/client";
import { useAuth } from "@/App";
import { cn } from "@/lib/utils";
import { WatchDot } from "@/components/WatchBadge";
import { useToast } from "@/components/ui/use-toast";
import { REFERENCE_START, REFERENCE_WATCHES, nextChangeYear, nextReferenceCard, periodLabel, referenceHolders, watchReferences } from "@/lib/referenceRota";
import { coverNow, useReferences } from "@/lib/references";
import { ReferenceHeader } from "@/components/tasks/RoutineHeader";

// Station references (Nov 2026): the station standards' Appendix A (the five
// watch references and the duties for all watches) and Appendix B (the
// 10-year planner) in one place. Each watch holds a reference for two years
// and is secondary on the next one — covering it when the main watch is off.
// WCs and CCs can edit the wording; who holds what comes from the planner.
// Each reference also has monthly, quarterly and annual cards of checks that
// go on the holding watch's shift board (lib/referenceRota.ts on the server).

type Ref = references.StationReference;

/** "## Heading" lines and "- item" lines ⇄ sections, for the editor. */
const toText = (sections: references.ReferenceSection[]) =>
  sections.map((s) => [`## ${s.heading}`, ...s.items.map((i) => `- ${i}`)].join("\n")).join("\n\n");
function fromText(text: string): references.ReferenceSection[] {
  const out: references.ReferenceSection[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) out.push({ heading: line.replace(/^#+\s*/, ""), items: [] });
    else {
      if (!out.length) out.push({ heading: "", items: [] });
      out[out.length - 1].items.push(line.replace(/^[-•*]\s*/, ""));
    }
  }
  return out;
}

export default function References() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const year = new Date().getFullYear();
  const watch = user?.watch_unit ?? "";
  const mine = watch ? watchReferences(watch, year) : null;
  const canEdit = user?.role === "WC" || user?.role === "CC";
  const { data, isLoading } = useReferences();
  const byRef = new Map((data ?? []).map((r) => [r.ref, r]));

  useEffect(() => {
    if (!hash || isLoading) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, isLoading]);

  const blocks = [0, 1, 2, 3, 4].map((i) => REFERENCE_START + i * 2 + 10 * Math.floor((year - REFERENCE_START) / 10));

  return (
    <div className="flex flex-col" style={{ gap: "var(--gap-section)" }}>
      <div>
        <div className="eyebrow">Station standards · {periodLabel(year)}</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">References</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Each watch holds a reference for two years and is secondary on the next one — the secondary watch covers it when the main watch is off.
          They move on together on <span className="font-medium text-foreground">1 January {nextChangeYear(year)}</span>.
        </p>
      </div>

      {/* ── The 10-year planner ─────────────────────────────────────────── */}
      <section aria-label="10-year planner" className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Watch</th>
              {blocks.map((b) => (
                <th key={b} className={cn("px-3 py-2.5 font-mono text-xs font-semibold", periodLabel(b) === periodLabel(year) ? "text-foreground" : "text-muted-foreground")}>
                  {periodLabel(b)}{periodLabel(b) === periodLabel(year) && <span className="ml-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background">NOW</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REFERENCE_WATCHES.map((w) => (
              <tr key={w} className={cn("border-b border-border/40 last:border-0", w === watch && "bg-muted/40")}>
                <td className="whitespace-nowrap px-4 py-2 font-medium"><WatchDot watch={w} size="sm" /> <span className="ml-1.5">{w}</span>{w === watch && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}</td>
                {blocks.map((b) => {
                  const r = watchReferences(w, b)!;
                  const now = periodLabel(b) === periodLabel(year);
                  return (
                    <td key={b} className={cn("px-3 py-2", now && "bg-muted/60")}>
                      <span className={cn("font-semibold", !now && "text-muted-foreground")}>Ref {r.main}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">sec. {r.secondary}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">Runs 1 January – 31 December; the ten-year cycle started in {REFERENCE_START} and repeats.</p>
      </section>

      {/* ── The references ──────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <ReferenceCard
            key={n}
            n={n}
            data={byRef.get(n)}
            loading={isLoading}
            canEdit={canEdit}
            badge={mine?.main === n ? "Your watch" : mine?.secondary === n ? "Your secondary" : null}
          />
        ))}
      </div>
      <ReferenceCard n={0} data={byRef.get(0)} loading={isLoading} canEdit={canEdit} badge={null} />
    </div>
  );
}

function ReferenceCard({ n, data, loading, canEdit, badge }: { n: number; data?: Ref; loading: boolean; canEdit: boolean; badge: string | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const year = new Date().getFullYear();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const all = n === 0;
  const holders = all ? null : referenceHolders(n, year);
  const cover = all ? null : coverNow(n);

  const save = useMutation({
    mutationFn: () => backend.references.saveReference(n, { title: title.trim(), sections: fromText(text) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["references"] });
      setEditing(false);
      toast({ title: `${all ? "All watches" : `Reference ${n}`} saved` });
    },
    onError: (e) => toast({ title: "Couldn't save", description: (e as Error).message, variant: "destructive" }),
  });

  return (
    <section id={`ref-${n}`} className={cn("scroll-mt-24 rounded-2xl border bg-card", badge === "Your watch" ? "border-foreground/60 ring-1 ring-foreground/20" : "border-border/70", all && "lg:col-span-2")}>
      <header className="flex flex-wrap items-start gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl font-mono text-lg font-semibold", all ? "bg-muted" : "bg-foreground text-background")}>{all ? "★" : n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{all ? "All watches" : `Reference ${n}`}</h2>
            {badge && <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">{badge}</span>}
          </div>
          <p className="text-sm text-muted-foreground">{data?.title ?? (loading ? "Loading…" : "Not written up yet")}</p>
          {holders && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="text-muted-foreground">Main</span> <WatchDot watch={holders.main} size="sm" /> <span className="font-medium">{holders.main} Watch</span></span>
              <span className="inline-flex items-center gap-1.5"><span className="text-muted-foreground">Secondary</span> <WatchDot watch={holders.secondary} size="sm" /> <span className="font-medium">{holders.secondary} Watch</span></span>
              <span className="text-muted-foreground">
                {cover?.as === "main" ? `On duty now: ${cover.watch} Watch` : cover?.as === "secondary" ? `${holders.main} Watch off — ${cover.watch} Watch covers it now` : `Neither is on duty now`}
              </span>
            </div>
          )}
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => { setTitle(data?.title ?? ""); setText(toText(data?.sections ?? [])); setEditing(true); }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </header>

      <div className="px-4 py-3.5 sm:px-5">
        {editing ? (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">Duties — a line starting "##" is a heading, each other line is a duty
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} className="mt-1 w-full rounded-lg border border-border bg-background p-2.5 font-mono text-xs leading-relaxed text-foreground" />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={save.isPending || !title.trim()} onClick={() => save.mutate()} className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50">
                {save.isPending ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg border border-border px-3 text-sm">Cancel</button>
            </div>
          </div>
        ) : data?.sections.length ? (
          <div className={cn("grid gap-x-8 gap-y-4", all && "md:grid-cols-2")}>
            {data.sections.map((s, i) => (
              <div key={i}>
                {s.heading && <h3 className="text-sm font-semibold">{s.heading}</h3>}
                <ul className="mt-1.5 space-y-1.5">
                  {s.items.map((item, j) => (
                    <li key={j} className="flex gap-2 text-sm text-muted-foreground"><span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{loading ? "Loading…" : canEdit ? "No duties written up yet — use Edit to add them." : "No duties written up yet."}</p>
        )}
      </div>
      {!all && <ReferenceCards n={n} cards={data?.cards ?? []} canEdit={canEdit} holder={holders!.main} />}
    </section>
  );
}

const CADENCES = [
  { key: "monthly", label: "Monthly", when: "Last tour of each month" },
  { key: "quarterly", label: "Quarterly", when: "Last tour of each quarter (Jun, Sep, Dec, Mar)" },
  { key: "annual", label: "Annual", when: "Last tour of the year" },
] as const;
const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** The reference's monthly / quarterly / annual cards of checks, as they go on the holding watch's board. */
function ReferenceCards({ n, cards, canEdit, holder }: { n: number; cards: references.ReferenceCard[]; canEdit: boolean; holder: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const card = (k: string) => cards.find((c) => c.cadence === k);
  const today = new Date();

  const save = useMutation({
    mutationFn: () => backend.references.saveReferenceCards(n, {
      cards: CADENCES.map((c) => ({
        cadence: c.key,
        items: draft[c.key].split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean),
        link: links[c.key].trim() || null,
      })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["references"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setEditing(false);
      toast({ title: `Reference ${n} cards saved` });
    },
    onError: (e) => toast({ title: "Couldn't save the cards", description: (e as Error).message, variant: "destructive" }),
  });
  const startEdit = () => {
    setDraft(Object.fromEntries(CADENCES.map((c) => [c.key, (card(c.key)?.items ?? []).join("\n")])));
    setLinks(Object.fromEntries(CADENCES.map((c) => [c.key, card(c.key)?.link ?? ""])));
    setEditing(true);
  };

  return (
    <div className="border-t border-border/60 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Cards on {holder} Watch's board</h3>
        {canEdit && !editing && (
          <button type="button" onClick={startEdit} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" /> Edit cards
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Each card comes up on the 1st day of the watch's last tour of the month, quarter or year, and is due by the end of that tour's 2nd night. If it isn't done by then, it stays on their board until it is.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {CADENCES.map((c) => {
          const cur = card(c.key);
          const next = cur?.items.length ? nextReferenceCard(n, c.key, today) : null;
          return (
            <div key={c.key} className="flex flex-col gap-2 rounded-xl border border-border/60 p-2">
              <ReferenceHeader refNo={n} cadence={c.key} height={44} radius={9} />
              <div className="text-[11px] text-muted-foreground">
                {c.when}
                {next && <> · <span className="font-medium text-foreground">{next.date <= today ? `this tour, from ${day(next.date)}` : `next ${day(next.date)}`}{next.watch !== holder ? ` (${next.watch} Watch)` : ""}</span></>}
              </div>
              {editing ? (
                <>
                  <textarea
                    value={draft[c.key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))}
                    rows={6}
                    placeholder="One check per line"
                    aria-label={`${c.label} checks`}
                    className="w-full rounded-lg border border-border bg-background p-2 text-xs leading-relaxed text-foreground"
                  />
                  <input
                    type="url"
                    value={links[c.key]}
                    onChange={(e) => setLinks((l) => ({ ...l, [c.key]: e.target.value }))}
                    placeholder="Link (optional) — https://…"
                    aria-label={`${c.label} card link`}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                  />
                </>
              ) : cur?.items.length ? (
                <>
                  <ul className="space-y-1">
                    {cur.items.map((i) => (
                      <li key={i} className="flex gap-2 text-xs"><span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />{i}</li>
                    ))}
                  </ul>
                  {cur.link && (
                    <a href={cur.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand hover:underline">
                      <ExternalLink className="h-3 w-3" /> Link on the card
                    </a>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No checks — no card.</p>
              )}
            </div>
          );
        })}
      </div>
      {editing && (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save cards"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg border border-border px-3 text-sm">Cancel</button>
        </div>
      )}
    </div>
  );
}
