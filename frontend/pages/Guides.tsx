import LibraryTabs from "@/components/library/LibraryTabs";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Eye, ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
import backend from "@/lib/backend";
import type { library } from "@/client";
import { useIsAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GuideBody } from "@/components/guides/GuideBody";
import { bySection, stepCount, textMatches } from "@/lib/guideMarkup";

// ──────────────────────────────────────────────────────────────────────────────
// Guides — the station's how-to guides (John, Nov 2026). They were ~30 Notion
// pages; here they're filed under headings, searchable, and each one opens as
// a set of steps you can tick through. The admin writes and edits them in a
// plain text box (the marks are in lib/guideMarkup.ts).
//   /guides           the library
//   /guides/:guideId  one guide
// ──────────────────────────────────────────────────────────────────────────────

type Guide = library.Guide;

interface Draft { id: number | null; section: string; title: string; summary: string; body: string }
const EMPTY: Draft = { id: null, section: "", title: "", summary: "", body: "" };

const updated = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function Guides() {
  const { guideId } = useParams();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState<Guide | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["guides"],
    queryFn: async () => (await backend.library.listGuides()).guides,
  });
  const guides = data ?? [];
  const headings = useMemo(() => bySection(guides).map((s) => s.section), [guides]);
  const sections = useMemo(
    () => bySection(guides.filter((g) => textMatches(query, g.title, g.summary, g.section, g.body))),
    [guides, query],
  );
  const open = guideId ? guides.find((g) => String(g.id) === guideId) : undefined;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["guides"] });

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = { section: d.section, title: d.title, summary: d.summary || null, body: d.body };
      return d.id === null ? backend.library.createGuide(body) : backend.library.updateGuide(d.id, body);
    },
    onSuccess: (g, d) => {
      refresh();
      setDraft(null);
      toast({ title: d.id === null ? "Guide added" : "Guide saved" });
      if (d.id === null) navigate(`/guides/${g.id}`);
    },
    onError: (e: any) => toast({ title: "Couldn't save it", description: e?.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => backend.library.removeGuide(id),
    onSuccess: () => { refresh(); setDeleting(null); setDraft(null); toast({ title: "Guide removed" }); navigate("/guides"); },
    onError: (e: any) => toast({ title: "Couldn't remove it", description: e?.message, variant: "destructive" }),
  });

  const edit = (g: Guide) => { setPreview(false); setDraft({ id: g.id, section: g.section, title: g.title, summary: g.summary ?? "", body: g.body }); };
  const valid = !!draft && draft.section.trim() !== "" && draft.title.trim() !== "";

  const editor = (
    <>
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id === null ? "New guide" : "Edit this guide"}</DialogTitle>
            <DialogDescription>Write it as you'd say it at the watch desk. Keep logins and passwords out: anyone who can open Guides can read this.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form className="flex min-h-0 flex-1 flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (valid && !save.isPending) save.mutate(draft); }}>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="guide-section">Section</Label>
                    <Input id="guide-section" list="guide-headings" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} placeholder="e.g. Defects and equipment" maxLength={60} />
                    <datalist id="guide-headings">{headings.map((h) => <option key={h} value={h} />)}</datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guide-title">Title</Label>
                    <Input id="guide-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Raising a station defect" maxLength={120} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guide-summary">One line on what it's for <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="guide-summary" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} maxLength={160} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="guide-body">The guide</Label>
                    <button type="button" onClick={() => setPreview((p) => !p)} className="tap inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                      <Eye className="h-3.5 w-3.5" />{preview ? "Back to writing" : "See how it looks"}
                    </button>
                  </div>
                  {preview ? (
                    <div className="min-h-[16rem] rounded-xl border p-4"><GuideBody body={draft.body} /></div>
                  ) : (
                    <Textarea id="guide-body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={14} className="min-h-[16rem] text-sm leading-relaxed" placeholder={"1. Sign in to the system\n2. Choose New Help Call\n\n> Station computers only"} />
                  )}
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Start a line with <code className="rounded bg-muted px-1">1.</code> for a step, <code className="rounded bg-muted px-1">-</code> for a point, <code className="rounded bg-muted px-1">##</code> for a heading, <code className="rounded bg-muted px-1">&gt;</code> for a note. <code className="rounded bg-muted px-1">**bold**</code> and pasted web addresses work too.
                  </p>
                </div>
              </div>
              <DialogFooter className="flex-row items-center gap-2 border-t pt-3 sm:justify-between">
                {draft.id !== null ? (
                  <Button type="button" variant="ghost" className="mr-auto text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30" onClick={() => setDeleting(guides.find((g) => g.id === draft.id) ?? null)}>
                    <Trash2 className="mr-2 h-4 w-4" />Remove
                  </Button>
                ) : <span className="mr-auto" />}
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
                <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>The guide is deleted for everyone. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => deleting && remove.mutate(deleting.id)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // ── One guide ──────────────────────────────────────────────────────────────
  if (guideId) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Link to="/guides" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />All guides
        </Link>
        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
        ) : !open ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">That guide isn't here</p>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed or renamed. Look for it in the list.</p>
          </div>
        ) : (
          <article className="bento-item rounded-2xl border border-border/70 bg-card p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{open.section}</p>
                <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight">{open.title}</h1>
                {open.summary && <p className="mt-1.5 text-sm text-muted-foreground">{open.summary}</p>}
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => edit(open)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>
              )}
            </div>
            <div className="mt-5 border-t pt-5"><GuideBody key={open.id} body={open.body} /></div>
            <p className="mt-6 text-xs text-muted-foreground">Last changed {updated(open.updated_at)}. Tap a step to tick it off as you go; the ticks aren't saved.</p>
          </article>
        )}
        {editor}
      </div>
    );
  }

  // ── The library ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <LibraryTabs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Guides</h1>
          <p className="mt-1 text-sm text-muted-foreground">How we do things at the station, step by step.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setPreview(false); setDraft({ ...EMPTY, section: headings[0] ?? "" }); }} className="h-11 sm:h-9"><Plus className="mr-2 h-4 w-4" />New guide</Button>
        )}
      </div>

      {guides.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the guides, e.g. defect, sickness, hydrant" aria-label="Search guides" className="h-11 pl-9" />
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">The guides couldn't be loaded. Try again in a minute.</div>
      ) : guides.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <ListChecks className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium">No guides yet</p>
          <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Write the first one: a process people ask you about most." : "The admin writes the station's how-to guides here."}</p>
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing matches "{query.trim()}".</div>
      ) : (
        sections.map((s) => (
          <section key={s.section.toLowerCase()} aria-label={s.section} className="space-y-2.5">
            <h2 className="text-sm font-semibold">{s.section}<span className="ml-2 text-xs font-normal text-muted-foreground">{s.lines.length}</span></h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.lines.map((g) => {
                const steps = stepCount(g.body);
                return (
                  <li key={g.id}>
                    <Link
                      to={`/guides/${g.id}`}
                      className="group relative flex h-full min-h-[6.5rem] flex-col rounded-2xl border border-border/70 bg-card p-4 pr-12 transition-[border-color,box-shadow] duration-200 hover:border-foreground/25 hover:shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)]"
                    >
                      <span className="break-words text-sm font-semibold">{g.title}</span>
                      {g.summary && <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.summary}</span>}
                      <span className="mt-auto pt-3 text-[11px] text-muted-foreground">
                        {steps > 0 ? `${steps} ${steps === 1 ? "step" : "steps"} · ` : ""}{updated(g.updated_at)}
                      </span>
                      <span aria-hidden className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border border-border/80 text-muted-foreground transition-[background-color,color,border-color,transform] duration-200 group-hover:rotate-45 group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {editor}
    </div>
  );
}
