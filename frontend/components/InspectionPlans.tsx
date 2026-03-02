import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useIsWC } from "@/lib/rbac";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Heart,
  Flame,
  ClipboardCheck,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronUpIcon,
  ChevronDownIcon,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────

type WatchName = "Red" | "White" | "Green" | "Blue" | "Amber";
const WATCHES: WatchName[] = ["Red", "White", "Green", "Blue", "Amber"];

const watchBadgeClass: Record<WatchName, string> = {
  Red: "bg-red-500/10 text-red-600 border-red-400/30",
  White: "bg-gray-100 text-gray-700 border-gray-300",
  Green: "bg-green-500/10 text-green-600 border-green-400/30",
  Blue: "bg-blue-500/10 text-blue-600 border-blue-400/30",
  Amber: "bg-amber-500/10 text-amber-600 border-amber-400/30",
};

function WatchBadge({ watch }: { watch?: WatchName | null }) {
  if (!watch) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Badge variant="outline" className={`text-xs font-medium ${watchBadgeClass[watch]}`}>
      {watch}
    </Badge>
  );
}

function WatchSelect({
  value,
  onChange,
  placeholder = "Assign watch",
}: {
  value?: WatchName | null;
  onChange: (v: WatchName | null) => void;
  placeholder?: string;
}) {
  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : (v as WatchName))}
    >
      <SelectTrigger className="h-8 text-xs w-[110px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">None</span>
        </SelectItem>
        {WATCHES.map((w) => (
          <SelectItem key={w} value={w}>
            <span className="font-medium">{w}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Reorder buttons ───────────────────────────────────────────────────────

function MoveButtons({
  onUp,
  onDown,
  isFirst,
  isLast,
  isPending,
}: {
  onUp: () => void;
  onDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onUp}
        disabled={isFirst || isPending}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        title="Move up"
      >
        <ChevronUpIcon className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={isLast || isPending}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        title="Move down"
      >
        <ChevronDownIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Icon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm mt-0.5">{description}</CardDescription>
            </div>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}

// ─── Multi-Story Inspections ───────────────────────────────────────────────

function MultistorySection({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [newAddr, setNewAddr] = useState("");
  const [newQ1, setNewQ1] = useState<WatchName | null>(null);
  const [newQ2, setNewQ2] = useState<WatchName | null>(null);
  const [newQ3, setNewQ3] = useState<WatchName | null>(null);
  const [newQ4, setNewQ4] = useState<WatchName | null>(null);

  type EditState = { address: string; q1: WatchName | null; q2: WatchName | null; q3: WatchName | null; q4: WatchName | null };
  const [editId, setEditId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ address: "", q1: null, q2: null, q3: null, q4: null });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [movePending, setMovePending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inspection-plans-multistory"],
    queryFn: () => backend.inspection_plans.listMultistory(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      backend.inspection_plans.createMultistory({
        address: newAddr.trim(),
        q1_watch: newQ1 ?? undefined,
        q2_watch: newQ2 ?? undefined,
        q3_watch: newQ3 ?? undefined,
        q4_watch: newQ4 ?? undefined,
      }),
    onSuccess: () => {
      toast({ title: "Entry added" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-multistory"] });
      setAdding(false);
      setNewAddr(""); setNewQ1(null); setNewQ2(null); setNewQ3(null); setNewQ4(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to add entry", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      backend.inspection_plans.updateMultistory(editId!, {
        address: editState.address,
        q1_watch: editState.q1 ?? undefined,
        q2_watch: editState.q2 ?? undefined,
        q3_watch: editState.q3 ?? undefined,
        q4_watch: editState.q4 ?? undefined,
      }),
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-multistory"] });
      setEditId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => backend.inspection_plans.deleteMultistory(id),
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-multistory"] });
      setConfirmDelete(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const moveItem = async (index: number, direction: "up" | "down") => {
    const items = data?.items ?? [];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    setMovePending(true);
    try {
      const posA = items[index].position;
      const posB = items[targetIndex].position;
      await backend.inspection_plans.updateMultistory(items[index].id, { position: posB });
      await backend.inspection_plans.updateMultistory(items[targetIndex].id, { position: posA });
      qc.invalidateQueries({ queryKey: ["inspection-plans-multistory"] });
    } catch {
      toast({ title: "Error", description: "Failed to reorder", variant: "destructive" });
    } finally {
      setMovePending(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {canEdit && <th className="w-[36px]" />}
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Address</th>
              <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[115px]">Q1</th>
              <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[115px]">Q2</th>
              <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[115px]">Q3</th>
              <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[115px]">Q4</th>
              {canEdit && <th className="w-[80px]" />}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>
            )}
            {!isLoading && items.length === 0 && !adding && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No entries yet. Click "Add entry" to begin.</td></tr>
            )}
            {items.map((item, index) =>
              editId === item.id ? (
                <tr key={item.id} className="border-b border-border bg-blue-500/5">
                  {canEdit && <td className="px-2 py-2" />}
                  <td className="px-4 py-2">
                    <Input className="h-8 text-xs" value={editState.address} onChange={(e) => setEditState((s) => ({ ...s, address: e.target.value }))} autoFocus />
                  </td>
                  {(["q1", "q2", "q3", "q4"] as const).map((q, qi) => (
                    <td key={q} className="px-3 py-2 text-center">
                      <WatchSelect value={editState[q]} onChange={(v) => setEditState((s) => ({ ...s, [q]: v }))} placeholder={`Q${qi + 1}`} />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  {canEdit && (
                    <td className="px-2 py-3">
                      <MoveButtons onUp={() => moveItem(index, "up")} onDown={() => moveItem(index, "down")} isFirst={index === 0} isLast={index === items.length - 1} isPending={movePending} />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{item.address}</td>
                  {[item.q1_watch, item.q2_watch, item.q3_watch, item.q4_watch].map((w, i) => (
                    <td key={i} className="px-3 py-3 text-center"><WatchBadge watch={w as WatchName | null} /></td>
                  ))}
                  {canEdit && (
                    <td className="px-3 py-3">
                      {confirmDelete === item.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setConfirmDelete(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(item.id); setEditState({ address: item.address, q1: (item.q1_watch ?? null) as WatchName | null, q2: (item.q2_watch ?? null) as WatchName | null, q3: (item.q3_watch ?? null) as WatchName | null, q4: (item.q4_watch ?? null) as WatchName | null }); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            )}
            {canEdit && adding && (
              <tr className="border-t border-border bg-green-500/5">
                <td className="px-2 py-2" />
                <td className="px-4 py-2">
                  <Input className="h-8 text-xs" placeholder="Enter address…" value={newAddr} onChange={(e) => setNewAddr(e.target.value)} autoFocus />
                </td>
                {([newQ1, newQ2, newQ3, newQ4] as const).map((val, i) => (
                  <td key={i} className="px-3 py-2 text-center">
                    <WatchSelect value={val} onChange={(v) => [setNewQ1, setNewQ2, setNewQ3, setNewQ4][i](v)} placeholder={`Q${i + 1}`} />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => newAddr.trim() && createMutation.mutate()} disabled={!newAddr.trim() || createMutation.isPending}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setAdding(false); setNewAddr(""); setNewQ1(null); setNewQ2(null); setNewQ3(null); setNewQ4(null); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canEdit && !adding && (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add entry
        </Button>
      )}
    </div>
  );
}

// ─── Care Home Validations ─────────────────────────────────────────────────

function CareHomeSection({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [newAddr, setNewAddr] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editAddr, setEditAddr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [movePending, setMovePending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inspection-plans-care-homes"],
    queryFn: () => backend.inspection_plans.listCareHomes(),
  });

  const createMutation = useMutation({
    mutationFn: () => backend.inspection_plans.createCareHome({ address: newAddr.trim() }),
    onSuccess: () => {
      toast({ title: "Care home added" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-care-homes"] });
      setAdding(false); setNewAddr("");
    },
    onError: () => toast({ title: "Error", description: "Failed to add entry", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => backend.inspection_plans.updateCareHome(editId!, { address: editAddr }),
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-care-homes"] });
      setEditId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => backend.inspection_plans.deleteCareHome(id),
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-care-homes"] });
      setConfirmDelete(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const moveItem = async (index: number, direction: "up" | "down") => {
    const items = data?.items ?? [];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    setMovePending(true);
    try {
      const posA = items[index].position;
      const posB = items[targetIndex].position;
      await backend.inspection_plans.updateCareHome(items[index].id, { position: posB });
      await backend.inspection_plans.updateCareHome(items[targetIndex].id, { position: posA });
      qc.invalidateQueries({ queryKey: ["inspection-plans-care-homes"] });
    } catch {
      toast({ title: "Error", description: "Failed to reorder", variant: "destructive" });
    } finally {
      setMovePending(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>All watches are required to complete validation visits to each care home listed below on an annual basis.</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {canEdit && <th className="w-[36px]" />}
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Address</th>
              {canEdit && <th className="w-[80px]" />}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={3} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>
            )}
            {!isLoading && items.length === 0 && !adding && (
              <tr><td colSpan={3} className="text-center py-6 text-muted-foreground text-xs">No care homes added yet.</td></tr>
            )}
            {items.map((item, index) =>
              editId === item.id ? (
                <tr key={item.id} className="border-b border-border bg-blue-500/5">
                  {canEdit && <td className="px-2 py-2" />}
                  <td className="px-4 py-2">
                    <Input className="h-8 text-xs" value={editAddr} onChange={(e) => setEditAddr(e.target.value)} autoFocus />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  {canEdit && (
                    <td className="px-2 py-3">
                      <MoveButtons onUp={() => moveItem(index, "up")} onDown={() => moveItem(index, "down")} isFirst={index === 0} isLast={index === items.length - 1} isPending={movePending} />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{item.address}</td>
                  {canEdit && (
                    <td className="px-3 py-3">
                      {confirmDelete === item.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setConfirmDelete(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(item.id); setEditAddr(item.address); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            )}
            {canEdit && adding && (
              <tr className="border-t border-border bg-green-500/5">
                <td className="px-2 py-2" />
                <td className="px-4 py-2">
                  <Input className="h-8 text-xs" placeholder="Enter address…" value={newAddr} onChange={(e) => setNewAddr(e.target.value)} autoFocus />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => newAddr.trim() && createMutation.mutate()} disabled={!newAddr.trim() || createMutation.isPending}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAdding(false); setNewAddr(""); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canEdit && !adding && (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add care home
        </Button>
      )}
    </div>
  );
}

// ─── Hydrant Register ──────────────────────────────────────────────────────

function HydrantSection({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [newFields, setNewFields] = useState({ area_code: "", street: "", section: "", year: new Date().getFullYear(), watch: null as WatchName | null });
  const [editId, setEditId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState({ area_code: "", street: "", section: "", year: 0, watch: null as WatchName | null });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [movePending, setMovePending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inspection-plans-hydrants"],
    queryFn: () => backend.inspection_plans.listHydrants(),
  });

  const createMutation = useMutation({
    mutationFn: () => backend.inspection_plans.createHydrant({
      area_code: newFields.area_code,
      street: newFields.street,
      section: newFields.section,
      year: newFields.year,
      watch: newFields.watch ?? undefined,
    }),
    onSuccess: () => {
      toast({ title: "Hydrant added" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-hydrants"] });
      setAdding(false);
      setNewFields({ area_code: "", street: "", section: "", year: new Date().getFullYear(), watch: null });
    },
    onError: () => toast({ title: "Error", description: "Failed to add hydrant", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => backend.inspection_plans.updateHydrant(editId!, {
      area_code: editFields.area_code,
      street: editFields.street,
      section: editFields.section,
      year: editFields.year,
      watch: editFields.watch ?? undefined,
    }),
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-hydrants"] });
      setEditId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => backend.inspection_plans.deleteHydrant(id),
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-hydrants"] });
      setConfirmDelete(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const moveItem = async (index: number, direction: "up" | "down") => {
    const items = data?.items ?? [];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    setMovePending(true);
    try {
      const posA = items[index].position;
      const posB = items[targetIndex].position;
      await backend.inspection_plans.updateHydrant(items[index].id, { position: posB });
      await backend.inspection_plans.updateHydrant(items[targetIndex].id, { position: posA });
      qc.invalidateQueries({ queryKey: ["inspection-plans-hydrants"] });
    } catch {
      toast({ title: "Error", description: "Failed to reorder", variant: "destructive" });
    } finally {
      setMovePending(false);
    }
  };

  const items = data?.items ?? [];
  const isNewValid = newFields.area_code.trim() && newFields.street.trim() && newFields.section.trim() && newFields.year > 2000;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {canEdit && <th className="w-[36px]" />}
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-[110px]">Area Code</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Street</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[100px]">Section</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[80px]">Year</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[115px]">Watch</th>
              {canEdit && <th className="w-[80px]" />}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>
            )}
            {!isLoading && items.length === 0 && !adding && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">No hydrant entries yet.</td></tr>
            )}
            {items.map((item, index) =>
              editId === item.id ? (
                <tr key={item.id} className="border-b border-border bg-blue-500/5">
                  {canEdit && <td className="px-2 py-2" />}
                  <td className="px-4 py-2"><Input className="h-8 text-xs" value={editFields.area_code} onChange={(e) => setEditFields((s) => ({ ...s, area_code: e.target.value }))} autoFocus /></td>
                  <td className="px-3 py-2"><Input className="h-8 text-xs" value={editFields.street} onChange={(e) => setEditFields((s) => ({ ...s, street: e.target.value }))} /></td>
                  <td className="px-3 py-2"><Input className="h-8 text-xs" value={editFields.section} onChange={(e) => setEditFields((s) => ({ ...s, section: e.target.value }))} /></td>
                  <td className="px-3 py-2"><Input className="h-8 text-xs w-[70px]" type="number" value={editFields.year} onChange={(e) => setEditFields((s) => ({ ...s, year: parseInt(e.target.value) || s.year }))} /></td>
                  <td className="px-3 py-2"><WatchSelect value={editFields.watch} onChange={(v) => setEditFields((s) => ({ ...s, watch: v }))} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  {canEdit && (
                    <td className="px-2 py-3">
                      <MoveButtons onUp={() => moveItem(index, "up")} onDown={() => moveItem(index, "down")} isFirst={index === 0} isLast={index === items.length - 1} isPending={movePending} />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{item.area_code}</td>
                  <td className="px-3 py-3">{item.street}</td>
                  <td className="px-3 py-3">{item.section}</td>
                  <td className="px-3 py-3">{item.year}</td>
                  <td className="px-3 py-3"><WatchBadge watch={item.watch as WatchName | null} /></td>
                  {canEdit && (
                    <td className="px-3 py-3">
                      {confirmDelete === item.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setConfirmDelete(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(item.id); setEditFields({ area_code: item.area_code, street: item.street, section: item.section, year: item.year, watch: (item.watch ?? null) as WatchName | null }); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            )}
            {canEdit && adding && (
              <tr className="border-t border-border bg-green-500/5">
                <td className="px-2 py-2" />
                <td className="px-4 py-2"><Input className="h-8 text-xs" placeholder="Area code" value={newFields.area_code} onChange={(e) => setNewFields((s) => ({ ...s, area_code: e.target.value }))} autoFocus /></td>
                <td className="px-3 py-2"><Input className="h-8 text-xs" placeholder="Street" value={newFields.street} onChange={(e) => setNewFields((s) => ({ ...s, street: e.target.value }))} /></td>
                <td className="px-3 py-2"><Input className="h-8 text-xs" placeholder="Section" value={newFields.section} onChange={(e) => setNewFields((s) => ({ ...s, section: e.target.value }))} /></td>
                <td className="px-3 py-2"><Input className="h-8 text-xs w-[70px]" type="number" value={newFields.year} onChange={(e) => setNewFields((s) => ({ ...s, year: parseInt(e.target.value) || s.year }))} /></td>
                <td className="px-3 py-2"><WatchSelect value={newFields.watch} onChange={(v) => setNewFields((s) => ({ ...s, watch: v }))} /></td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => isNewValid && createMutation.mutate()} disabled={!isNewValid || createMutation.isPending}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAdding(false); setNewFields({ area_code: "", street: "", section: "", year: new Date().getFullYear(), watch: null }); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canEdit && !adding && (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add hydrant
        </Button>
      )}
    </div>
  );
}

// ─── Operational Inspections ───────────────────────────────────────────────

function OperationalSection({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [newFields, setNewFields] = useState({ address: "", uprn: "", watch: null as WatchName | null });
  const [editId, setEditId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState({ address: "", uprn: "", watch: null as WatchName | null });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [movePending, setMovePending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inspection-plans-operational"],
    queryFn: () => backend.inspection_plans.listOperational(),
  });

  const createMutation = useMutation({
    mutationFn: () => backend.inspection_plans.createOperational({
      address: newFields.address,
      uprn: newFields.uprn,
      watch: newFields.watch ?? undefined,
    }),
    onSuccess: () => {
      toast({ title: "Entry added", description: "Operational inspection added" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-operational"] });
      setAdding(false);
      setNewFields({ address: "", uprn: "", watch: null });
    },
    onError: () => toast({ title: "Error", description: "Failed to add entry", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => backend.inspection_plans.updateOperational(editId!, {
      address: editFields.address,
      uprn: editFields.uprn,
      watch: editFields.watch ?? undefined,
    }),
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-operational"] });
      setEditId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => backend.inspection_plans.deleteOperational(id),
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["inspection-plans-operational"] });
      setConfirmDelete(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const moveItem = async (index: number, direction: "up" | "down") => {
    const items = data?.items ?? [];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    setMovePending(true);
    try {
      const posA = items[index].position;
      const posB = items[targetIndex].position;
      await backend.inspection_plans.updateOperational(items[index].id, { position: posB });
      await backend.inspection_plans.updateOperational(items[targetIndex].id, { position: posA });
      qc.invalidateQueries({ queryKey: ["inspection-plans-operational"] });
    } catch {
      toast({ title: "Error", description: "Failed to reorder", variant: "destructive" });
    } finally {
      setMovePending(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {canEdit && <th className="w-[36px]" />}
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Address</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[160px]">UPRN</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[115px]">Watch</th>
              {canEdit && <th className="w-[80px]" />}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>
            )}
            {!isLoading && items.length === 0 && !adding && (
              <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">No operational inspection entries yet.</td></tr>
            )}
            {items.map((item, index) =>
              editId === item.id ? (
                <tr key={item.id} className="border-b border-border bg-blue-500/5">
                  {canEdit && <td className="px-2 py-2" />}
                  <td className="px-4 py-2"><Input className="h-8 text-xs" value={editFields.address} onChange={(e) => setEditFields((s) => ({ ...s, address: e.target.value }))} autoFocus /></td>
                  <td className="px-3 py-2"><Input className="h-8 text-xs" value={editFields.uprn} onChange={(e) => setEditFields((s) => ({ ...s, uprn: e.target.value }))} /></td>
                  <td className="px-3 py-2"><WatchSelect value={editFields.watch} onChange={(v) => setEditFields((s) => ({ ...s, watch: v }))} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  {canEdit && (
                    <td className="px-2 py-3">
                      <MoveButtons onUp={() => moveItem(index, "up")} onDown={() => moveItem(index, "down")} isFirst={index === 0} isLast={index === items.length - 1} isPending={movePending} />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{item.address}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{item.uprn}</td>
                  <td className="px-3 py-3"><WatchBadge watch={item.watch as WatchName | null} /></td>
                  {canEdit && (
                    <td className="px-3 py-3">
                      {confirmDelete === item.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setConfirmDelete(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(item.id); setEditFields({ address: item.address, uprn: item.uprn, watch: (item.watch ?? null) as WatchName | null }); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            )}
            {canEdit && adding && (
              <tr className="border-t border-border bg-green-500/5">
                <td className="px-2 py-2" />
                <td className="px-4 py-2"><Input className="h-8 text-xs" placeholder="Enter address…" value={newFields.address} onChange={(e) => setNewFields((s) => ({ ...s, address: e.target.value }))} autoFocus /></td>
                <td className="px-3 py-2"><Input className="h-8 text-xs" placeholder="UPRN" value={newFields.uprn} onChange={(e) => setNewFields((s) => ({ ...s, uprn: e.target.value }))} /></td>
                <td className="px-3 py-2"><WatchSelect value={newFields.watch} onChange={(v) => setNewFields((s) => ({ ...s, watch: v }))} /></td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => (newFields.address.trim() && newFields.uprn.trim()) && createMutation.mutate()} disabled={!newFields.address.trim() || !newFields.uprn.trim() || createMutation.isPending}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAdding(false); setNewFields({ address: "", uprn: "", watch: null }); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canEdit && !adding && (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add entry
        </Button>
      )}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────

export function InspectionPlans() {
  const isWC = useIsWC();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Inspection Plans</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the register of sites and assets that form part of your quarterly inspection targets.
          {!isWC && " (Read-only — contact your Watch Commander to make changes)"}
        </p>
      </div>

      <SectionCard icon={Building2} title="Multi-Story Inspections" description="Premises requiring quarterly inspection — one watch assigned per quarter">
        <MultistorySection canEdit={isWC} />
      </SectionCard>

      <SectionCard icon={Heart} title="Care Home Validations" description="Annual care home visits — all watches attend each property">
        <CareHomeSection canEdit={isWC} />
      </SectionCard>

      <SectionCard icon={Flame} title="Hydrant Register" description="Fire hydrant register by area code, street and section">
        <HydrantSection canEdit={isWC} />
      </SectionCard>

      <SectionCard icon={ClipboardCheck} title="Operational Inspections" description="Annual operational inspections — one watch assigned per premises">
        <OperationalSection canEdit={isWC} />
      </SectionCard>
    </div>
  );
}
