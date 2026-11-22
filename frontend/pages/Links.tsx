import LibraryTabs from "@/components/library/LibraryTabs";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, FolderPlus, Link2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import backend from "@/lib/backend";
import type { library } from "@/client";
import { useIsAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { bySection, hostOf, isInternal, textMatches } from "@/lib/guideMarkup";

// ──────────────────────────────────────────────────────────────────────────────
// Links — the systems and sites the station uses (John, Nov 2026). They were a
// list on a Notion page. Here they sit under headings, each one a tap away;
// the admin adds, changes and removes them, and whole sections.
// ──────────────────────────────────────────────────────────────────────────────

type StationLink = library.StationLink;

interface Draft { id: number | null; newSection?: boolean; section: string; title: string; url: string; note: string }
const EMPTY: Draft = { id: null, section: "", title: "", url: "", note: "" };

export default function Links() {
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<StationLink | null>(null);
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [removingSection, setRemovingSection] = useState<{ section: string; count: number } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["station-links"],
    queryFn: async () => (await backend.library.listLinks()).links,
  });
  const links = data ?? [];
  const all = useMemo(() => bySection(links), [links]);
  const sections = useMemo(
    () => bySection(links.filter((l) => textMatches(query, l.title, l.section, l.note, hostOf(l.url)))),
    [links, query],
  );
  const headings = all.map((s) => s.section);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["station-links"] });
  const fail = (title: string) => (e: any) => toast({ title, description: e?.message, variant: "destructive" });

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = { section: d.section, title: d.title, url: d.url.trim(), note: d.note || null };
      return d.id === null ? backend.library.createLink(body) : backend.library.updateLink(d.id, body);
    },
    onSuccess: (_r, d) => { refresh(); setDraft(null); toast({ title: d.id === null ? "Link added" : "Link updated" }); },
    onError: fail("Couldn't save it"),
  });
  const remove = useMutation({
    mutationFn: (id: number) => backend.library.removeLink(id),
    onSuccess: () => { refresh(); setDeleting(null); setDraft(null); toast({ title: "Link removed" }); },
    onError: fail("Couldn't remove it"),
  });
  const renameSection = useMutation({
    mutationFn: (r: { from: string; to: string }) => backend.library.renameSection({ kind: "links", section: r.from, to: r.to }),
    onSuccess: () => { refresh(); setRenaming(null); toast({ title: "Section renamed" }); },
    onError: fail("Couldn't rename it"),
  });
  const removeSection = useMutation({
    mutationFn: (section: string) => backend.library.removeSection({ kind: "links", section }),
    onSuccess: (r) => { refresh(); setRemovingSection(null); toast({ title: "Section removed", description: `${r.lines} ${r.lines === 1 ? "link" : "links"} taken off.` }); },
    onError: fail("Couldn't remove it"),
  });

  const valid = !!draft && draft.section.trim() !== "" && draft.title.trim() !== "" && /^https?:\/\/\S+/i.test(draft.url.trim());

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <LibraryTabs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Links</h1>
          <p className="mt-1 text-sm text-muted-foreground">The systems and sites the station uses. Some only open on a station computer.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDraft({ ...EMPTY, newSection: true })} className="h-11 sm:h-9"><FolderPlus className="mr-2 h-4 w-4" />New section</Button>
            <Button onClick={() => setDraft({ ...EMPTY, section: headings[0] ?? "" })} className="h-11 sm:h-9"><Plus className="mr-2 h-4 w-4" />Add a link</Button>
          </div>
        )}
      </div>

      {links.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a system or site" aria-label="Search links" className="h-11 pl-9" />
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">The links couldn't be loaded. Try again in a minute.</div>
      ) : links.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Link2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium">No links yet</p>
          <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Add the systems people open most: the rota, pay, training, SharePoint." : "The admin adds the station's regular links here."}</p>
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing matches "{query.trim()}".</div>
      ) : (
        sections.map((s) => (
          <section key={s.section.toLowerCase()} aria-label={s.section} className="space-y-2.5">
            <header className="flex items-center justify-between gap-2">
              <h2 className="min-w-0 truncate text-sm font-semibold">{s.section}<span className="ml-2 text-xs font-normal text-muted-foreground">{s.lines.length}</span></h2>
              {isAdmin && (
                <div className="flex shrink-0 items-center">
                  {([
                    [Plus, `Add a link to ${s.section}`, () => setDraft({ ...EMPTY, section: s.section })],
                    [Pencil, `Rename the ${s.section} section`, () => setRenaming({ from: s.section, to: s.section })],
                    [Trash2, `Remove the ${s.section} section`, () => setRemovingSection({ section: s.section, count: all.find((x) => x.section === s.section)?.lines.length ?? s.lines.length })],
                  ] as const).map(([Icon, label, onClick]) => (
                    <button key={label} type="button" aria-label={label} title={label} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:h-8 sm:w-8">
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              )}
            </header>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.lines.map((l) => (
                <li key={l.id} className="relative">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex h-full min-h-[4.5rem] items-start gap-3 rounded-2xl border border-border/70 bg-card p-3.5 pr-11 transition-[border-color,box-shadow] duration-200 hover:border-foreground/25 hover:shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold">{l.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hostOf(l.url)}</span>
                      {(l.note || isInternal(l.url)) && (
                        <span className="mt-1.5 block break-words text-xs text-muted-foreground">{l.note ?? "Opens on a station computer only"}</span>
                      )}
                    </span>
                    <span aria-hidden className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border border-border/80 text-muted-foreground transition-[background-color,color,border-color,transform] duration-200 group-hover:rotate-45 group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </a>
                  {isAdmin && (
                    <button
                      type="button"
                      aria-label={`Change ${l.title}`}
                      onClick={() => setDraft({ id: l.id, section: l.section, title: l.title, url: l.url, note: l.note ?? "" })}
                      className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg pointer-coarse:bottom-1 pointer-coarse:right-1 pointer-coarse:h-10 pointer-coarse:w-10 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {/* Add or change a link */}
      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.newSection ? "New section" : draft?.id === null ? "Add a link" : "Change this link"}</DialogTitle>
            <DialogDescription>{draft?.newSection ? "Name the section and give it its first link." : "Everyone who can open Links sees it."}</DialogDescription>
          </DialogHeader>
          {draft && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid && !save.isPending) save.mutate(draft); }}>
              <div className="space-y-1.5">
                <Label htmlFor="link-section">{draft.newSection ? "Section name" : "Section"}</Label>
                <Input id="link-section" list={draft.newSection ? undefined : "link-headings"} autoFocus={!!draft.newSection} value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} placeholder="e.g. Systems" maxLength={60} />
                <datalist id="link-headings">{headings.map((h) => <option key={h} value={h} />)}</datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-title">Name</Label>
                <Input id="link-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Kronos" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-url">Address</Label>
                <Input id="link-url" inputMode="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://" maxLength={2000} />
                <p className="text-xs text-muted-foreground">Paste the page's address. Leave out anything after a ? if it has your name or a session in it.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="link-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. Watch Commanders only" maxLength={200} />
              </div>
              <DialogFooter className="flex-row items-center gap-2 pt-2 sm:justify-between">
                {draft.id !== null ? (
                  <Button type="button" variant="ghost" className="mr-auto text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30" onClick={() => setDeleting(links.find((l) => l.id === draft.id) ?? null)}>
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

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rename this section</DialogTitle><DialogDescription>Its links stay as they are.</DialogDescription></DialogHeader>
          {renaming && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (renaming.to.trim() && !renameSection.isPending) renameSection.mutate(renaming); }}>
              <div className="space-y-1.5">
                <Label htmlFor="link-section-name">Section name</Label>
                <Input id="link-section-name" autoFocus value={renaming.to} onChange={(e) => setRenaming({ ...renaming, to: e.target.value })} maxLength={60} />
              </div>
              <DialogFooter className="flex-row justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
                <Button type="submit" disabled={!renaming.to.trim() || renaming.to.trim() === renaming.from || renameSection.isPending}>Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removingSection} onOpenChange={(open) => !open && setRemovingSection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the {removingSection?.section} section?</AlertDialogTitle>
            <AlertDialogDescription>{removingSection?.count === 1 ? "Its 1 link comes" : `All ${removingSection?.count} of its links come`} off the page for everyone. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => removingSection && removeSection.mutate(removingSection.section)}>Remove section</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.title}?</AlertDialogTitle>
            <AlertDialogDescription>It comes off the Links page for everyone. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => deleting && remove.mutate(deleting.id)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
