import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import {
  X, Plus, Trash2, Pencil, Repeat, CheckCircle2, Zap, Play, ChevronRight,
} from "lucide-react";
import type { TaskTemplate, TaskCategory, TaskPriority, ChecklistItem } from "~backend/task/types";

interface TaskTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate: (template: TaskTemplate) => void;
  canManage?: boolean;
}

const DAYS_OF_WEEK = [
  { key: "MO", label: "Mon" },
  { key: "TU", label: "Tue" },
  { key: "WE", label: "Wed" },
  { key: "TH", label: "Thu" },
  { key: "FR", label: "Fri" },
  { key: "SA", label: "Sat" },
  { key: "SU", label: "Sun" },
];

const CATEGORY_OPTIONS: TaskCategory[] = ["Training", "Inspection", "HFSV", "Admin", "Other"];
const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "High", label: "High" },
  { value: "Med", label: "Medium" },
  { value: "Low", label: "Low" },
];

const FREQ_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly (select days)" },
  { value: "MONTHLY", label: "Monthly" },
];

function buildRrule(freq: string, selectedDays: string[], interval: number): string {
  if (freq === "WEEKLY" && selectedDays.length > 0) {
    return `FREQ=WEEKLY;BYDAY=${selectedDays.join(",")};INTERVAL=${interval}`;
  }
  return `FREQ=${freq};INTERVAL=${interval}`;
}

function parseRruleDisplay(rrule: string): string {
  const parts: Record<string, string> = {};
  rrule.split(";").forEach((p) => { const [k, v] = p.split("="); if (k && v) parts[k] = v; });
  const freq = parts["FREQ"] ?? "";
  const byday = parts["BYDAY"] ?? "";
  const interval = parseInt(parts["INTERVAL"] ?? "1");

  if (freq === "DAILY") return interval === 1 ? "Every day" : `Every ${interval} days`;
  if (freq === "WEEKLY") {
    if (byday) {
      const dayMap: Record<string, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };
      const days = byday.split(",").map((d) => dayMap[d] || d).join(", ");
      return interval === 1 ? `Every ${days}` : `Every ${interval} weeks on ${days}`;
    }
    return interval === 1 ? "Every week" : `Every ${interval} weeks`;
  }
  if (freq === "MONTHLY") return interval === 1 ? "Every month" : `Every ${interval} months`;
  return rrule;
}

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-500/10 text-red-500 border-red-500/20",
  Med: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

interface TemplateFormState {
  name: string;
  title_template: string;
  task_description: string;
  category: TaskCategory;
  priority: TaskPriority;
  freq: string;
  interval: number;
  selectedDays: string[];
  checklist: ChecklistItem[];
  newItem: string;
}

const emptyForm = (): TemplateFormState => ({
  name: "",
  title_template: "",
  task_description: "",
  category: "Other",
  priority: "Med",
  freq: "WEEKLY",
  interval: 1,
  selectedDays: ["MO"],
  checklist: [],
  newItem: "",
});

function fromTemplate(t: TaskTemplate): TemplateFormState {
  const parts: Record<string, string> = {};
  t.rrule.split(";").forEach((p) => { const [k, v] = p.split("="); if (k && v) parts[k] = v; });
  return {
    name: t.name,
    title_template: t.title_template,
    task_description: t.task_description ?? "",
    category: t.category,
    priority: t.priority,
    freq: parts["FREQ"] ?? "WEEKLY",
    interval: parseInt(parts["INTERVAL"] ?? "1"),
    selectedDays: parts["BYDAY"] ? parts["BYDAY"].split(",") : ["MO"],
    checklist: t.checklist ?? [],
    newItem: "",
  };
}

export default function TaskTemplateManager({ isOpen, onClose, onUseTemplate, canManage }: TaskTemplateManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => (await backend.task.listTemplates()).templates,
    enabled: isOpen,
  });
  const templates = (data ?? []) as unknown as TaskTemplate[];

  const createMutation = useMutation({
    mutationFn: async (f: TemplateFormState) =>
      backend.task.createTemplate({
        name: f.name,
        title_template: f.title_template,
        task_description: f.task_description || undefined,
        category: f.category,
        priority: f.priority,
        checklist: f.checklist,
        rrule: buildRrule(f.freq, f.selectedDays, f.interval),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast({ title: "Template created" });
      setMode("list");
    },
    onError: () => toast({ title: "Error", description: "Failed to create template", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: number; f: TemplateFormState }) =>
      backend.task.updateTemplate(id, {
        name: f.name,
        title_template: f.title_template,
        task_description: f.task_description || undefined,
        category: f.category,
        priority: f.priority,
        checklist: f.checklist,
        rrule: buildRrule(f.freq, f.selectedDays, f.interval),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast({ title: "Template updated" });
      setMode("list");
    },
    onError: () => toast({ title: "Error", description: "Failed to update template", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => backend.task.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete template", variant: "destructive" }),
  });

  if (!isOpen) return null;

  const setF = (update: Partial<TemplateFormState>) => setForm((f) => ({ ...f, ...update }));

  const toggleDay = (day: string) => {
    setF({
      selectedDays: form.selectedDays.includes(day)
        ? form.selectedDays.filter((d) => d !== day)
        : [...form.selectedDays, day],
    });
  };

  const addChecklistItem = () => {
    if (!form.newItem.trim()) return;
    setF({ checklist: [...form.checklist, { label: form.newItem.trim(), done: false }], newItem: "" });
  };

  const removeChecklistItem = (idx: number) =>
    setF({ checklist: form.checklist.filter((_, i) => i !== idx) });

  const handleSave = () => {
    if (!form.name.trim() || !form.title_template.trim()) {
      toast({ title: "Validation", description: "Name and title are required", variant: "destructive" });
      return;
    }
    if (form.freq === "WEEKLY" && form.selectedDays.length === 0) {
      toast({ title: "Validation", description: "Select at least one day", variant: "destructive" });
      return;
    }
    if (mode === "create") createMutation.mutate(form);
    else if (mode === "edit" && editingId !== null) updateMutation.mutate({ id: editingId, f: form });
  };

  const handleEdit = (t: TaskTemplate) => {
    setEditingId(t.id);
    setForm(fromTemplate(t));
    setMode("edit");
  };

  const handleDelete = (t: TaskTemplate) => {
    if (confirm(`Delete template "${t.name}"?`)) deleteMutation.mutate(t.id);
  };

  const handleUse = (t: TaskTemplate) => {
    onUseTemplate(t);
    onClose();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {(mode === "create" || mode === "edit") && (
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setMode("list")}>
                <X className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold">
                {mode === "list" ? "Work Templates" : mode === "create" ? "New Template" : "Edit Template"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === "list"
                  ? "Recurring tasks that auto-generate on schedule"
                  : "Configure when this task auto-generates"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === "list" && canManage && (
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8" onClick={() => { setForm(emptyForm()); setMode("create"); }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Template
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* LIST MODE */}
          {mode === "list" && (
            <div className="p-4 space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Repeat className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No templates yet</p>
                  {canManage && (
                    <p className="text-xs mt-1">Click "New Template" to create your first recurring work template</p>
                  )}
                </div>
              ) : (
                templates.map((t) => (
                  <div key={t.id} className="flex items-start gap-3 p-3.5 rounded-lg border border-border hover:border-indigo-500/40 bg-background transition-colors group">
                    <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                      <Repeat className="h-4.5 w-4.5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold truncate">{t.name}</span>
                        <Badge className={PRIORITY_COLORS[t.priority]} variant="outline" style={{ fontSize: "10px" }}>
                          {t.priority}
                        </Badge>
                        <Badge variant="outline" style={{ fontSize: "10px" }}>{t.category}</Badge>
                        {!t.is_active && (
                          <Badge variant="outline" className="text-muted-foreground" style={{ fontSize: "10px" }}>Paused</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.title_template}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Repeat className="h-3 w-3 text-blue-500" />
                        <span className="text-xs text-blue-600 dark:text-blue-400">{parseRruleDisplay(t.rrule)}</span>
                        {t.checklist && t.checklist.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            · {t.checklist.length} checklist items
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleUse(t)}
                        title="Create a task from this template now"
                      >
                        <Play className="h-3 w-3" />
                        Use now
                      </Button>
                      {canManage && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100" onClick={() => handleEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => handleDelete(t)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CREATE / EDIT FORM */}
          {(mode === "create" || mode === "edit") && (
            <div className="p-6 space-y-5">
              {/* Template Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Template Name</label>
                <input
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background outline-none focus:border-red-500"
                  placeholder="e.g. Weekly Station Check"
                  value={form.name}
                  onChange={(e) => setF({ name: e.target.value })}
                />
              </div>

              {/* Task Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Task Title (generated card title)</label>
                <input
                  className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background outline-none focus:border-red-500"
                  placeholder="e.g. Station Equipment Check — Monday"
                  value={form.title_template}
                  onChange={(e) => setF({ title_template: e.target.value })}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description (optional)</label>
                <textarea
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background outline-none focus:border-red-500 resize-none"
                  placeholder="What does this task involve?"
                  value={form.task_description}
                  onChange={(e) => setF({ task_description: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
                  <Select value={form.category} onValueChange={(v) => setF({ category: v as TaskCategory })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</label>
                  <Select value={form.priority} onValueChange={(v) => setF({ priority: v as TaskPriority })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Recurrence */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold">Recurrence Schedule</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Frequency</label>
                    <Select value={form.freq} onValueChange={(v) => setF({ freq: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQ_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Every N {form.freq === "DAILY" ? "days" : form.freq === "WEEKLY" ? "weeks" : "months"}</label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      className="w-full h-8 rounded-md border border-input px-3 text-sm bg-background outline-none focus:border-red-500"
                      value={form.interval}
                      onChange={(e) => setF({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
                    />
                  </div>
                </div>

                {form.freq === "WEEKLY" && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Days of week</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d.key}
                          onClick={() => toggleDay(d.key)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            form.selectedDays.includes(d.key)
                              ? "bg-red-500 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Preview: {parseRruleDisplay(buildRrule(form.freq, form.selectedDays, form.interval))}
                </div>
              </div>

              {/* Checklist Builder */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Checklist ({form.checklist.length} items)
                </label>
                <div className="space-y-1.5">
                  {form.checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm">{item.label}</span>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                        onClick={() => removeChecklistItem(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 h-8 rounded-md border border-input px-3 text-sm bg-background outline-none focus:border-red-500"
                    placeholder="Add checklist item…"
                    value={form.newItem}
                    onChange={(e) => setF({ newItem: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") addChecklistItem(); }}
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addChecklistItem} disabled={!form.newItem.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer for form modes */}
        {(mode === "create" || mode === "edit") && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
            <Button variant="ghost" onClick={() => setMode("list")}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving…" : mode === "create" ? "Create Template" : "Save Changes"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
