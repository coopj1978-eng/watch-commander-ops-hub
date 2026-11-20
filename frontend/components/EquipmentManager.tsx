import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, MoreHorizontal, Package, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useIsWatchCommander } from "@/lib/rbac";
import backend from "@/lib/backend";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, kitSections, lockersOf, moveItem, moveSection, shelvesOf } from "@/lib/kitList";
import type { appliance } from "@/client";

// The kit list editor (Nov 2026): an appliance's kit by locker (or cab) and
// shelf, as the J4 folder has it and as the J4 check walks it. A WC or CC
// adds, changes and reorders; headings can be renamed; a WC removes.

type Item = appliance.EquipmentItem;

interface EquipmentManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applianceId: number;
  applianceName: string;
}

const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

/** More kit than this and the list shows one locker at a time. */
const LONG_LIST = 30;

interface ItemForm {
  /** The item being changed; none when adding. */
  id?: number;
  name: string;
  category: string;
  serial_number: string;
  quantity: number;
  locker: string;
  shelf: string;
}
const BLANK: ItemForm = { name: "", category: "Other", serial_number: "", quantity: 1, locker: "", shelf: "" };

/** A heading being renamed or removed: a locker, or one shelf of it. */
interface Heading {
  locker: string;
  shelf?: string;
  count: number;
}
const headingName = (h: Heading) => (h.shelf !== undefined ? `${h.shelf || "the unshelved part"} in ${h.locker}` : h.locker);

const iconBtn = "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground";

export default function EquipmentManager({
  open,
  onOpenChange,
  applianceId,
  applianceName,
}: EquipmentManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isWC = useIsWatchCommander();
  const [form, setForm] = useState<ItemForm | null>(null);
  const [renaming, setRenaming] = useState<(Heading & { to: string }) | null>(null);
  const [removingHeading, setRemovingHeading] = useState<Heading | null>(null);
  const [removingItem, setRemovingItem] = useState<Item | null>(null);
  // Which lockers are open; null until one is opened or closed by hand.
  const [opened, setOpened] = useState<Set<string> | null>(null);

  const { data: equipmentData, isLoading } = useQuery({
    queryKey: ["equipment", applianceId],
    queryFn: () => backend.appliance.listEquipment({ appliance_id: applianceId }),
    enabled: open,
  });
  const items = equipmentData?.items || [];
  const sections = kitSections(items);
  const lockers = lockersOf(items);
  const longList = items.length > LONG_LIST;
  const isOpen = (key: string) => (opened ? opened.has(key) : !longList);
  const toggle = (key: string) =>
    setOpened((prev) => {
      const next = new Set(prev ?? (longList ? [] : sections.map((s) => s.key)));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["equipment", applianceId] });
  const failed = (title: string) => (e: any) => toast({ title, description: e?.message, variant: "destructive" });

  const saveItem = useMutation({
    mutationFn: async (f: ItemForm) => {
      const fields = {
        name: f.name.trim(),
        category: f.category as any,
        quantity: f.quantity,
        // "" takes an item out of its locker, or off its shelf.
        locker: f.locker.trim(),
        shelf: f.locker.trim() ? f.shelf.trim() : "",
      };
      return f.id
        ? backend.appliance.updateEquipment(f.id, { ...fields, serial_number: f.serial_number.trim() })
        : backend.appliance.createEquipment({ appliance_id: applianceId, ...fields, serial_number: f.serial_number.trim() || undefined });
    },
    onSuccess: (_d, f) => {
      refresh();
      toast({ title: f.id ? "Item changed" : `${f.name.trim()} added` });
      // Show the locker it went into.
      if (f.locker.trim()) setOpened((prev) => new Set([...(prev ?? (longList ? [] : sections.map((s) => s.key))), `locker:${f.locker.trim().toLowerCase()}`]));
      setForm(null);
    },
    onError: failed("Couldn't save it"),
  });

  const removeItem = useMutation({
    mutationFn: (id: number) => backend.appliance.deleteEquipment(id),
    onSuccess: () => { refresh(); toast({ title: "Item removed" }); setRemovingItem(null); setForm(null); },
    onError: failed("Couldn't remove it"),
  });

  const renameHeading = useMutation({
    mutationFn: (r: Heading & { to: string }) =>
      backend.appliance.renameSection({
        appliance_id: applianceId, locker: r.locker, ...(r.shelf !== undefined ? { shelf: r.shelf } : {}), new_name: r.to.trim(),
      }),
    onSuccess: (_d, r) => {
      refresh();
      toast({ title: "Renamed" });
      // Keep a renamed locker open.
      if (r.shelf === undefined) {
        setOpened((prev) => {
          const was = `locker:${r.locker.trim().toLowerCase()}`;
          if (!prev?.has(was)) return prev;
          const next = new Set(prev);
          next.delete(was);
          next.add(`locker:${r.to.trim().toLowerCase()}`);
          return next;
        });
      }
      setRenaming(null);
    },
    onError: failed("Couldn't rename it"),
  });

  const removeHeading = useMutation({
    mutationFn: (h: Heading) =>
      backend.appliance.removeSection({ appliance_id: applianceId, locker: h.locker, ...(h.shelf !== undefined ? { shelf: h.shelf } : {}) }),
    onSuccess: (d) => { refresh(); toast({ title: `${d.removed} ${d.removed === 1 ? "item" : "items"} removed` }); setRemovingHeading(null); },
    onError: failed("Couldn't remove it"),
  });

  const reorder = useMutation({
    mutationFn: (ids: number[]) => backend.appliance.reorderEquipment({ appliance_id: applianceId, ids }),
    onSuccess: refresh,
    onError: failed("Couldn't move it"),
  });
  const move = (ids: number[] | null) => { if (ids && !reorder.isPending) reorder.mutate(ids); };

  const editItem = (item: Item) =>
    setForm({
      id: item.id, name: item.name, category: item.category, serial_number: item.serial_number || "",
      quantity: item.quantity, locker: item.locker || "", shelf: item.shelf || "",
    });

  const lockerSections = sections.filter((s) => s.isLocker);
  const formValid = !!form && form.name.trim().length > 0 && form.quantity >= 1;
  const formShelves = form ? shelvesOf(items, form.locker) : [];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="flex items-start gap-2 leading-snug">
            <Package className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="min-w-0 break-words">Kit list · {applianceName}</span>
          </DialogTitle>
          <DialogDescription>
            What's on this appliance, by locker and shelf, in the order the J4 check goes through it. Changes apply to the next check.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "items"}
              {lockerSections.length > 0 ? ` in ${lockerSections.length} ${lockerSections.length === 1 ? "locker" : "lockers and cabs"}` : ""}
            </p>
            <Button onClick={() => setForm(BLANK)} size="sm" className="h-10">
              <Plus className="h-4 w-4 mr-2" />
              Add item
            </Button>
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading the kit list…</p>
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing on this appliance's kit list yet. Add the first item, and give it the locker or cab it's kept in.
            </p>
          ) : (
            sections.map((section) => {
              const open = isOpen(section.key);
              const lockerAt = lockerSections.findIndex((s) => s.key === section.key);
              const whole: Heading = { locker: section.name, count: section.count };
              return (
                <section key={section.key} className="rounded-xl border border-border">
                  <div className="flex items-center gap-1 pr-1">
                    <h3 className="min-w-0 flex-1">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggle(section.key)}
                        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted/50"
                      >
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} aria-hidden />
                        <span className="min-w-0">
                          <span className="block font-semibold leading-snug">{section.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {section.count} {section.count === 1 ? "item" : "items"}
                            {!section.isLocker && " · no locker set"}
                          </span>
                        </span>
                      </button>
                    </h3>
                    {section.isLocker && (
                      <>
                        <button
                          type="button"
                          className={iconBtn}
                          aria-label={`Add an item to ${section.name}`}
                          title="Add an item here"
                          onClick={() => setForm({ ...BLANK, locker: section.name })}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className={iconBtn} aria-label={`More for ${section.name}`} title="Rename, move or remove">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={() => setRenaming({ ...whole, to: section.name })}>
                              <Pencil className="h-4 w-4" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={lockerAt <= 0} onSelect={() => move(moveSection(sections, section.key, -1))}>
                              <ArrowUp className="h-4 w-4" /> Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={lockerAt >= lockerSections.length - 1} onSelect={() => move(moveSection(sections, section.key, 1))}>
                              <ArrowDown className="h-4 w-4" /> Move down
                            </DropdownMenuItem>
                            {isWC && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => setRemovingHeading(whole)}>
                                  <Trash2 className="h-4 w-4" /> Remove with its items
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>

                  {open && (
                    <div className="space-y-3 border-t border-border p-3">
                      {!section.isLocker && (
                        <p className="text-xs text-muted-foreground">
                          These have no locker yet. Use the pencil on an item to say where it's kept.
                        </p>
                      )}
                      {section.shelves.map((shelf) => {
                        const part: Heading = { locker: section.name, shelf: shelf.name, count: shelf.items.length };
                        return (
                          <div key={shelf.name || "_"}>
                            {section.isLocker && (shelf.name || section.shelves.length > 1) && (
                              <div className="flex items-center gap-1">
                                <h4 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  {shelf.name || "No shelf"}
                                </h4>
                                <button
                                  type="button"
                                  className={iconBtn}
                                  aria-label={`Add an item to ${shelf.name || "this part"} of ${section.name}`}
                                  title="Add an item here"
                                  onClick={() => setForm({ ...BLANK, locker: section.name, shelf: shelf.name })}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                                {shelf.name && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button type="button" className={iconBtn} aria-label={`More for ${shelf.name} of ${section.name}`} title="Rename or remove">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52">
                                      <DropdownMenuItem onSelect={() => setRenaming({ ...part, to: shelf.name })}>
                                        <Pencil className="h-4 w-4" /> Rename
                                      </DropdownMenuItem>
                                      {isWC && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => setRemovingHeading(part)}>
                                            <Trash2 className="h-4 w-4" /> Remove with its items
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            )}
                            <ul className="divide-y divide-border rounded-lg border border-border">
                              {shelf.items.map((item, at) => (
                                <li key={item.id} className="flex min-h-12 items-center gap-1 py-1 pl-3 pr-1">
                                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span className="font-medium">{item.name}</span>
                                    {item.quantity > 1 && <span className="text-sm text-muted-foreground">× {item.quantity}</span>}
                                    {item.serial_number && (
                                      <Badge variant="outline" className="text-xs">S/N: {item.serial_number}</Badge>
                                    )}
                                  </div>
                                  <button type="button" className={iconBtn} aria-label={`Change ${item.name}`} title="Change this item" onClick={() => editItem(item)}>
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button type="button" className={iconBtn} aria-label={`More for ${item.name}`} title="Move or remove">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                      <DropdownMenuItem disabled={at === 0} onSelect={() => move(moveItem(sections, item.id, -1))}>
                                        <ArrowUp className="h-4 w-4" /> Move up
                                      </DropdownMenuItem>
                                      <DropdownMenuItem disabled={at === shelf.items.length - 1} onSelect={() => move(moveItem(sections, item.id, 1))}>
                                        <ArrowDown className="h-4 w-4" /> Move down
                                      </DropdownMenuItem>
                                      {isWC && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => setRemovingItem(item)}>
                                            <Trash2 className="h-4 w-4" /> Remove
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ── Add or change one item ── */}
    <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{form?.id ? "Change this item" : "Add an item"}</DialogTitle>
          <DialogDescription>
            {form?.id
              ? "Changing the locker or shelf moves it there."
              : "To start a new locker, cab or shelf, type its name."}
          </DialogDescription>
        </DialogHeader>
        {form && (
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); if (formValid && !saveItem.isPending) saveItem.mutate(form); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="kit-name">Name</Label>
              <Input id="kit-name" autoFocus value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Salvage Sheets" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kit-qty">How many</Label>
                <Input
                  id="kit-qty" type="number" inputMode="numeric" min={1} value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kit-type">Type</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger id="kit-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kit-locker">Locker or cab</Label>
              <Input
                id="kit-locker" list="kit-lockers" value={form.locker} maxLength={80}
                onChange={(e) => setForm({ ...form, locker: e.target.value })}
                placeholder="e.g. Offside Front · Locker 7"
              />
              <datalist id="kit-lockers">{lockers.map((l) => <option key={l} value={l} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kit-shelf">Shelf <span className="font-normal text-muted-foreground">(if the locker has them)</span></Label>
              <Input
                id="kit-shelf" list="kit-shelves" value={form.shelf} maxLength={80} disabled={!form.locker.trim()}
                onChange={(e) => setForm({ ...form, shelf: e.target.value })}
                placeholder="e.g. Shelf 3"
              />
              <datalist id="kit-shelves">{formShelves.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kit-serial">Serial or set number <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="kit-serial" value={form.serial_number} maxLength={60} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <DialogFooter className="flex-row items-center justify-end gap-2 pt-2">
              {form.id && isWC && (
                <Button
                  type="button" variant="ghost" className="mr-auto text-red-600 hover:text-red-700"
                  onClick={() => { const item = items.find((i) => i.id === form.id); if (item) setRemovingItem(item); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Remove
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" disabled={!formValid || saveItem.isPending}>{saveItem.isPending ? "Saving…" : form.id ? "Save" : "Add"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>

    {/* ── Rename a locker or shelf ── */}
    <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Rename {renaming?.shelf !== undefined ? "this shelf" : "this locker or cab"}</DialogTitle>
          <DialogDescription>Its items stay as they are.</DialogDescription>
        </DialogHeader>
        {renaming && (
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); if (renaming.to.trim() && !renameHeading.isPending) renameHeading.mutate(renaming); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="kit-heading">Name</Label>
              <Input id="kit-heading" autoFocus value={renaming.to} maxLength={80} onChange={(e) => setRenaming({ ...renaming, to: e.target.value })} />
            </div>
            <DialogFooter className="flex-row justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
              <Button
                type="submit"
                disabled={!renaming.to.trim() || renaming.to.trim() === (renaming.shelf ?? renaming.locker) || renameHeading.isPending}
              >
                {renameHeading.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>

    {/* ── Remove a whole locker or shelf ── */}
    <AlertDialog open={!!removingHeading} onOpenChange={(o) => !o && setRemovingHeading(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {removingHeading ? headingName(removingHeading) : ""}?</AlertDialogTitle>
          <AlertDialogDescription>
            This takes {removingHeading?.count === 1 ? "its 1 item" : `all ${removingHeading?.count} of its items`} off the kit list, so they stop
            being checked. Past checks keep their record of them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={(e) => { e.preventDefault(); if (removingHeading && !removeHeading.isPending) removeHeading.mutate(removingHeading); }}
          >
            {removeHeading.isPending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* ── Remove one item ── */}
    <AlertDialog open={!!removingItem} onOpenChange={(o) => !o && setRemovingItem(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {removingItem?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            It comes off the kit list and stops being checked. Past checks keep their record of it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={(e) => { e.preventDefault(); if (removingItem && !removeItem.isPending) removeItem.mutate(removingItem.id); }}
          >
            {removeItem.isPending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
