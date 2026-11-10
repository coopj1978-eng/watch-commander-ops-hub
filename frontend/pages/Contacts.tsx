import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { groupContacts, sectionNames, splitNumbers, type ContactLine } from "@/lib/contacts";

// ──────────────────────────────────────────────────────────────────────────────
// Contacts — the station's regular phone numbers (John, Nov 2026): what was on
// the office whiteboard. Everyone reads it; a full number is a tap-to-call
// link. A Watch or Crew Commander adds, changes and removes lines.
// ──────────────────────────────────────────────────────────────────────────────

interface Draft {
  id: number | null;
  section: string;
  name: string;
  detail: string;
  numbers: string;
  note: string;
}

const EMPTY: Draft = { id: null, section: "", name: "", detail: "", numbers: "", note: "" };

export default function Contacts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = user?.role === "WC" || user?.role === "CC";

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<ContactLine | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => (await backend.contacts.list()).contacts as ContactLine[],
  });
  const lines = data ?? [];
  const sections = useMemo(() => groupContacts(lines, query), [lines, query]);
  const headings = useMemo(() => sectionNames(lines), [lines]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = { section: d.section, name: d.name, detail: d.detail || null, numbers: d.numbers, note: d.note || null };
      return d.id === null ? backend.contacts.create(body) : backend.contacts.update(d.id, body);
    },
    onSuccess: (_r, d) => {
      refresh();
      setDraft(null);
      toast({ title: d.id === null ? "Number added" : "Number updated" });
    },
    onError: (e: any) => toast({ title: "Couldn't save it", description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => backend.contacts.remove(id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      setDraft(null);
      toast({ title: "Number removed" });
    },
    onError: (e: any) => toast({ title: "Couldn't remove it", description: e?.message, variant: "destructive" }),
  });

  const valid = !!draft && draft.section.trim() !== "" && draft.name.trim() !== "" && /\d/.test(draft.numbers);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">The station's regular numbers. Tap a full number to call it.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setDraft({ ...EMPTY, section: headings[0] ?? "" })} className="h-11 sm:h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add a number
          </Button>
        )}
      </div>

      {lines.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a name, station or number"
            aria-label="Search contacts"
            className="h-11 pl-9"
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          The contacts couldn't be loaded. Pull down to refresh, or try again in a minute.
        </div>
      ) : lines.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Phone className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium">No numbers yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canEdit ? "Add the numbers the station uses most: Control, staffing, the other stations." : "Your Watch or Crew Commander adds the station's numbers here."}
          </p>
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing matches "{query.trim()}".
        </div>
      ) : (
        sections.map((s) => (
          <section key={s.section.toLowerCase()} aria-label={s.section} className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-baseline justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
              <h2 className="min-w-0 truncate text-sm font-semibold">{s.section}</h2>
              <span className="shrink-0 text-xs text-muted-foreground">{s.lines.length}</span>
            </header>
            <ul className="divide-y">
              {s.lines.map((line) => (
                <li key={line.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{line.name}</p>
                      {line.detail && <p className="break-words text-sm text-muted-foreground">{line.detail}</p>}
                      {line.note && <p className="mt-0.5 break-words text-xs text-muted-foreground">{line.note}</p>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-0 sm:max-w-[60%] sm:justify-end">
                      {splitNumbers(line.numbers).map((n, i) =>
                        n.tel ? (
                          <a
                            key={i}
                            href={`tel:${n.tel}`}
                            aria-label={`Call ${line.name} on ${n.text}`}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-3 text-sm font-semibold tabular-nums text-brand hover:bg-brand/10 sm:min-h-9"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {n.text}
                          </a>
                        ) : (
                          <span
                            key={i}
                            title="A desk extension or local number"
                            className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium tabular-nums text-foreground sm:min-h-9"
                          >
                            {n.text}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Change ${line.name}`}
                      onClick={() => setDraft({ id: line.id, section: line.section, name: line.name, detail: line.detail ?? "", numbers: line.numbers, note: line.note ?? "" })}
                      className="grid h-11 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:h-9"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {lines.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Short numbers are desk extensions, for a station phone. {canEdit ? "Use the pencil to change or remove a line." : "A Watch or Crew Commander keeps this page up to date."}
        </p>
      )}

      {/* Add or change a line */}
      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id === null ? "Add a number" : "Change this number"}</DialogTitle>
            <DialogDescription>Everyone who can open Contacts sees it.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); if (valid && !save.isPending) save.mutate(draft); }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="contact-section">Heading</Label>
                <Input
                  id="contact-section"
                  list="contact-headings"
                  value={draft.section}
                  onChange={(e) => setDraft({ ...draft, section: e.target.value })}
                  placeholder="e.g. Control and staffing"
                  maxLength={60}
                />
                <datalist id="contact-headings">
                  {headings.map((h) => <option key={h} value={h} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-name">Who or what</Label>
                <Input id="contact-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Control" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-detail">What it's for <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="contact-detail" value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="e.g. Property manager" maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-numbers">Number</Label>
                <Input id="contact-numbers" inputMode="tel" value={draft.numbers} onChange={(e) => setDraft({ ...draft, numbers: e.target.value })} placeholder="e.g. 3999 / 0141 000 0000" maxLength={200} />
                <p className="text-xs text-muted-foreground">More than one? Put a / between them.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="contact-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. Office hours only" maxLength={300} />
              </div>
              <DialogFooter className="flex-row items-center gap-2 pt-2 sm:justify-between">
                {draft.id !== null ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mr-auto text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                    onClick={() => setDeleting(lines.find((l) => l.id === draft.id) ?? null)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                ) : <span className="mr-auto" />}
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
                <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>It comes off the Contacts page for everyone. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
