import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import backend from "@/lib/backend";
import { useAuth } from "@/App";
import { useToast } from "@/components/ui/use-toast";
import { priorityKey, priorityLabel } from "@/lib/taskUi";
import {
  X, Plus, Trash2, Repeat, Play, ChevronDown, ChevronLeft, GripVertical, Check, Minus,
} from "lucide-react";
import type { TaskTemplate, TaskCategory, TaskPriority, ChecklistItem, TaskColumn } from "~backend/task/types";

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

// The four schedule choices in the design. "Weekly on days" and "Every N
// weeks" are both FREQ=WEEKLY — the second just has an interval of 2+.
type Sched = "DAILY" | "WEEKLY" | "NWEEKS" | "MONTHLY";
const SCHED_OPTIONS: { value: Sched; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly on days" },
  { value: "NWEEKS", label: "Every N weeks" },
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

interface TemplateFormState {
  name: string;
  title_template: string;
  task_description: string;
  category: TaskCategory;
  priority: TaskPriority;
  freq: string;
  sched: Sched;
  interval: number;
  selectedDays: string[];
  checklist: ChecklistItem[];
  newItem: string;
  /** Only used when creating — an existing template's switch saves straight away. */
  is_active: boolean;
}

const emptyForm = (): TemplateFormState => ({
  name: "",
  title_template: "",
  task_description: "",
  category: "Other",
  priority: "Med",
  freq: "WEEKLY",
  sched: "WEEKLY",
  interval: 1,
  selectedDays: ["MO"],
  checklist: [],
  newItem: "",
  is_active: true,
});

function fromTemplate(t: TaskTemplate): TemplateFormState {
  const parts: Record<string, string> = {};
  t.rrule.split(";").forEach((p) => { const [k, v] = p.split("="); if (k && v) parts[k] = v; });
  const freq = parts["FREQ"] ?? "WEEKLY";
  const interval = parseInt(parts["INTERVAL"] ?? "1");
  const sched: Sched =
    freq === "WEEKLY" ? (interval > 1 ? "NWEEKS" : "WEEKLY") : freq === "DAILY" || freq === "MONTHLY" ? freq : "WEEKLY";
  return {
    name: t.name,
    title_template: t.title_template,
    task_description: t.task_description ?? "",
    category: t.category,
    priority: t.priority,
    freq,
    sched,
    interval,
    selectedDays: parts["BYDAY"] ? parts["BYDAY"].split(",") : ["MO"],
    checklist: t.checklist ?? [],
    newItem: "",
    is_active: t.is_active !== false,
  };
}

/** "each day", "every Mon, Thu", "every 2 weeks on Mon" … or null when no day is picked. */
function schedulePhrase(f: TemplateFormState): string | null {
  const n = f.interval;
  if (f.freq === "DAILY") return n === 1 ? "each day" : `every ${n} days`;
  if (f.freq === "WEEKLY") {
    const days = DAYS_OF_WEEK.filter((d) => f.selectedDays.includes(d.key)).map((d) => d.label).join(", ");
    if (!days) return null;
    return n === 1 ? `every ${days}` : `every ${n} weeks on ${days}`;
  }
  if (f.freq === "MONTHLY") return n === 1 ? "each month" : `every ${n} months`;
  return parseRruleDisplay(buildRrule(f.freq, f.selectedDays, f.interval)).toLowerCase();
}

// ── Local helpers (v2 design) ────────────────────────────────────────────────

/** On/off switch (green when on). */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="ttm-switch cal-focus"
      data-on={checked ? "" : undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="ttm-knob" />
    </button>
  );
}

/** Segmented single-choice control: a radiogroup with arrow-key support. */
function Segmented<T extends string>({
  label, options, value, onChange, className,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.findIndex((o) => o.value === value);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`ttm-seg ${className ?? ""}`}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (current < 0 && i === 0) ? 0 : -1}
            className="cal-focus"
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A small tinted tag (schedule, priority, category…). */
function Tag({ bg, fg, weight = 600, children }: { bg: string; fg: string; weight?: number; children: React.ReactNode }) {
  return <span className="ttm-tag" style={{ background: bg, color: fg, fontWeight: weight }}>{children}</span>;
}

export default function TaskTemplateManager({ isOpen, onClose, onUseTemplate, canManage }: TaskTemplateManagerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyForm());
  const [addingItem, setAddingItem] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const { data, isLoading } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => (await backend.task.listTemplates()).templates,
    enabled: isOpen,
  });
  const templates = (data ?? []) as unknown as TaskTemplate[];

  // Same query (and cache) as the Tasks page — only used for column names in the copy.
  const { data: columnsData } = useQuery({
    queryKey: ["task-columns"],
    queryFn: async () => (await backend.task.listColumns()).columns,
    enabled: isOpen,
  });
  const columns = (columnsData ?? []) as unknown as TaskColumn[];

  const createMutation = useMutation({
    mutationFn: async (f: TemplateFormState) => {
      const created = await backend.task.createTemplate({
        name: f.name,
        title_template: f.title_template,
        task_description: f.task_description || undefined,
        category: f.category,
        priority: f.priority,
        checklist: f.checklist,
        rrule: buildRrule(f.freq, f.selectedDays, f.interval),
      });
      // New templates start active; if it was switched off in the form, pause it.
      if (!f.is_active) await backend.task.updateTemplate(created.id, { is_active: false });
      return created;
    },
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

  // Active on/off — saves straight away (optimistic), from the card or the form.
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) =>
      backend.task.updateTemplate(id, { is_active }),
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: ["task-templates"] });
      const prev = queryClient.getQueryData(["task-templates"]);
      queryClient.setQueryData(["task-templates"], (old: unknown) =>
        Array.isArray(old) ? old.map((t: TaskTemplate) => (t.id === id ? { ...t, is_active } : t)) : old
      );
      return { prev };
    },
    onSuccess: (_d, { is_active }) =>
      toast({ title: is_active ? "Template on" : "Template paused", description: is_active ? "Cards will be created on schedule." : "No cards will be created until it's switched back on." }),
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["task-templates"], ctx.prev);
      toast({ title: "Error", description: "Failed to update template", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["task-templates"] }),
  });

  // Escape closes; focus moves into the dialog and back to the opener on close.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const setF = (update: Partial<TemplateFormState>) => setForm((f) => ({ ...f, ...update }));

  const toggleDay = (day: string) => {
    setF({
      selectedDays: form.selectedDays.includes(day)
        ? form.selectedDays.filter((d) => d !== day)
        : [...form.selectedDays, day],
    });
  };

  const setSched = (s: Sched) => {
    if (s === form.sched) return;
    if (s === "NWEEKS") setF({ sched: s, freq: "WEEKLY", interval: Math.max(2, form.interval) });
    else setF({ sched: s, freq: s, interval: 1 });
  };

  const intervalMin = form.sched === "NWEEKS" ? 2 : 1;
  const setIntervalN = (n: number) => setF({ interval: Math.min(52, Math.max(1, n)) });

  const addChecklistItem = () => {
    if (!form.newItem.trim()) return;
    setF({ checklist: [...form.checklist, { label: form.newItem.trim(), done: false }], newItem: "" });
  };

  const removeChecklistItem = (idx: number) =>
    setF({ checklist: form.checklist.filter((_, i) => i !== idx) });

  const moveChecklistItem = (from: number, to: number) => {
    if (from === to) return;
    const next = [...form.checklist];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setF({ checklist: next });
  };

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

  const scrollFormTop = () => formRef.current?.scrollTo({ top: 0 });

  const handleNew = () => {
    setForm(emptyForm());
    setAddingItem(false);
    setMode("create");
    scrollFormTop();
  };

  const handleEdit = (t: TaskTemplate) => {
    setEditingId(t.id);
    setForm(fromTemplate(t));
    setAddingItem(false);
    setMode("edit");
    scrollFormTop();
  };

  const handleDelete = (t: TaskTemplate) => {
    if (confirm(`Delete template "${t.name}"?`)) {
      deleteMutation.mutate(t.id, { onSuccess: () => { if (editingId === t.id) setMode("list"); } });
    }
  };

  const handleUse = (t: TaskTemplate) => {
    onUseTemplate(t);
    onClose();
  };

  const setActive = (t: TaskTemplate, next: boolean) => toggleActiveMutation.mutate({ id: t.id, is_active: next });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const inForm = mode === "create" || mode === "edit";
  const editing = mode === "edit" ? templates.find((t) => t.id === editingId) : undefined;
  const formActive = editing ? editing.is_active !== false : form.is_active;
  const firstColName = columns[0]?.name ?? "To Do";
  const generatedColName = columns.find((c) => c.status_key === "NotStarted")?.name ?? firstColName;
  const phrase = schedulePhrase(form);
  const cardTitle = form.title_template.trim();
  const intervalUnit = form.freq === "DAILY" ? "days" : form.freq === "MONTHLY" ? "months" : "weeks";
  const watch = user?.watch_unit;

  // Portalled to <body> so it sits above the phone bottom nav (same z-index).
  return createPortal(
    <div className="ttm-overlay cal-ui">
      <style>{TTM_CSS}</style>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ttm-title"
        tabIndex={-1}
        className="ttm-dialog"
        data-narrow={canManage ? undefined : ""}
      >
        <span className="ttm-grab" aria-hidden="true" />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="ttm-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span className="ttm-eyebrow cal-mono">
              {watch ? `${watch} Watch · ` : ""}{canManage ? "WC / CC only" : "Set by WC / CC"}
            </span>
            <h2 id="ttm-title" className="ttm-h1">Work templates</h2>
            <span className="ttm-sub">Recurring tasks that create cards automatically on schedule.</span>
          </div>
          <span style={{ flex: 1 }} />
          {canManage && (
            <button type="button" className="ttm-pill cal-focus" onClick={handleNew}>
              New template
              <span className="ttm-pill-plus"><Plus size={15} strokeWidth={2.6} aria-hidden="true" /></span>
            </button>
          )}
          <button type="button" aria-label="Close" className="ttm-close cal-focus" onClick={onClose}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="ttm-body" data-view={inForm ? "form" : "list"} data-single={canManage ? undefined : ""}>
          {/* ── List ─────────────────────────────────────────────────────── */}
          <div className="ttm-list">
            {isLoading ? (
              [0, 1, 2].map((i) => <div key={i} className="ttm-skel" aria-hidden="true" />)
            ) : templates.length === 0 ? (
              <div className="ttm-empty">
                <span className="ttm-icon" style={{ width: 48, height: 48, borderRadius: 14 }}>
                  <Repeat size={22} strokeWidth={2} aria-hidden="true" />
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--cal-ink)" }}>No templates yet</span>
                {canManage && (
                  <span style={{ fontSize: 13 }}>Use “New template” to set up your first recurring card.</span>
                )}
              </div>
            ) : (
              templates.map((t) => {
                const active = t.is_active !== false;
                const count = t.checklist?.length ?? 0;
                return (
                  <article
                    key={t.id}
                    aria-label={t.name}
                    className="ttm-card"
                    data-selected={mode === "edit" && editingId === t.id ? "" : undefined}
                    data-paused={active ? undefined : ""}
                  >
                    <div className="ttm-card-top">
                      <span className="ttm-icon"><Repeat size={18} strokeWidth={2} aria-hidden="true" /></span>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className="ttm-name">{t.name}</span>
                        <span className="ttm-cardtitle">Card title: {t.title_template}</span>
                      </div>
                      {canManage && <Switch checked={active} onChange={(v) => setActive(t, v)} label={`${t.name} active`} />}
                    </div>
                    <div className="ttm-row">
                      <Tag bg="var(--cal-brand-soft)" fg="var(--cal-brand-text)">{parseRruleDisplay(t.rrule)}</Tag>
                      <Tag bg={`var(--cal-${priorityKey(t.priority)}-bg)`} fg={`var(--cal-${priorityKey(t.priority)}-fg)`}>
                        {priorityLabel(t.priority)}
                      </Tag>
                      <Tag bg="var(--cal-surface-2)" fg="var(--cal-ink-2)" weight={500}>{t.category}</Tag>
                      {!active && <Tag bg="var(--cal-surface-3)" fg="var(--cal-muted)">Paused</Tag>}
                      {count > 0 && (
                        <span className="ttm-count">· {count} checklist item{count === 1 ? "" : "s"}</span>
                      )}
                    </div>
                    <div className="ttm-actions">
                      <button
                        type="button"
                        className="ttm-sbtn cal-focus"
                        onClick={() => handleUse(t)}
                        title="Create a task from this template now"
                      >
                        <Play size={13} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                        Use template
                      </button>
                      {canManage && (
                        <button type="button" className="ttm-sbtn cal-focus" data-ghost="" onClick={() => handleEdit(t)} aria-label={`Edit ${t.name}`}>
                          Edit
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
            {!isLoading && templates.length > 0 && (
              <span className="ttm-note">“Use template” adds a card to {firstColName} now. The schedule keeps running.</span>
            )}
            {canManage && (
              <div className="ttm-listbar">
                <button type="button" className="ttm-pill cal-focus" onClick={handleNew}>
                  New template
                  <span className="ttm-pill-plus"><Plus size={15} strokeWidth={2.6} aria-hidden="true" /></span>
                </button>
              </div>
            )}
          </div>

          {/* ── Form ─────────────────────────────────────────────────────── */}
          {canManage && (
            <div className="ttm-form" ref={formRef}>
              {!inForm ? (
                <div className="ttm-empty">
                  <span className="ttm-icon" style={{ width: 48, height: 48, borderRadius: 14 }}>
                    <Repeat size={22} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--cal-ink)" }}>Pick a template to edit</span>
                  <span style={{ fontSize: 13 }}>…or start a new one.</span>
                  <button type="button" className="ttm-btn cal-focus" style={{ marginTop: 6 }} onClick={handleNew}>
                    <Plus size={16} aria-hidden="true" /> New template
                  </button>
                </div>
              ) : (
                <>
                  <div className="ttm-form-head">
                    <button type="button" className="ttm-back cal-focus" aria-label="Back to templates" onClick={() => setMode("list")}>
                      <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                    <h3 className="ttm-form-title">{mode === "create" ? "New template" : "Edit template"}</h3>
                    <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--cal-ink-2)" }}>Active</span>
                    <Switch
                      checked={formActive}
                      label="Active"
                      onChange={(v) => (editing ? setActive(editing, v) : setF({ is_active: v }))}
                    />
                  </div>

                  <div className="ttm-grid2">
                    <label className="ttm-label">
                      Template name
                      <input
                        className="ttm-input"
                        placeholder="e.g. Weekly Station Check"
                        value={form.name}
                        onChange={(e) => setF({ name: e.target.value })}
                      />
                    </label>
                    <label className="ttm-label">
                      Card title
                      <input
                        className="ttm-input"
                        placeholder="e.g. Station Equipment Check"
                        value={form.title_template}
                        onChange={(e) => setF({ title_template: e.target.value })}
                      />
                    </label>
                  </div>

                  <label className="ttm-label">
                    Description
                    <textarea
                      className="ttm-input"
                      rows={2}
                      placeholder="Add a description…"
                      value={form.task_description}
                      onChange={(e) => setF({ task_description: e.target.value })}
                    />
                  </label>

                  <div className="ttm-grid2">
                    <label className="ttm-label">
                      Category
                      <span style={{ position: "relative" }}>
                        <select
                          className="ttm-input"
                          value={form.category}
                          onChange={(e) => setF({ category: e.target.value as TaskCategory })}
                        >
                          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown size={16} aria-hidden="true" className="ttm-select-chev" />
                      </span>
                    </label>
                    <div className="ttm-label">
                      <span>Priority</span>
                      <Segmented
                        label="Priority"
                        className="ttm-seg-3"
                        options={PRIORITY_OPTIONS}
                        value={form.priority}
                        onChange={(v) => setF({ priority: v })}
                      />
                    </div>
                  </div>

                  {/* Checklist */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="ttm-caption">
                      Checklist · {form.checklist.length} item{form.checklist.length === 1 ? "" : "s"}
                    </span>
                    <div className="ttm-cl">
                      {form.checklist.map((item, idx) => (
                        <div
                          key={idx}
                          className="ttm-cl-item"
                          draggable
                          data-dragging={dragIdx === idx ? "" : undefined}
                          data-over={overIdx === idx && dragIdx !== null && dragIdx !== idx ? "" : undefined}
                          onDragStart={(e) => {
                            setDragIdx(idx);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", String(idx));
                          }}
                          onDragOver={(e) => {
                            if (dragIdx === null) return;
                            e.preventDefault();
                            if (overIdx !== idx) setOverIdx(idx);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragIdx !== null) moveChecklistItem(dragIdx, idx);
                            setDragIdx(null);
                            setOverIdx(null);
                          }}
                          onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                        >
                          <GripVertical size={14} aria-hidden="true" className="ttm-grip" />
                          <span className="ttm-cl-label">{item.label}</span>
                          <button
                            type="button"
                            className="ttm-icon-btn cal-focus"
                            aria-label={`Remove ${item.label}`}
                            onClick={() => removeChecklistItem(idx)}
                          >
                            <X size={13} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                      {addingItem ? (
                        <div className="ttm-add-row">
                          <input
                            autoFocus
                            aria-label="New checklist item"
                            placeholder="Add checklist item…"
                            value={form.newItem}
                            onChange={(e) => setF({ newItem: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); }
                              if (e.key === "Escape") { e.preventDefault(); setAddingItem(false); setF({ newItem: "" }); }
                            }}
                            onBlur={() => { if (!form.newItem.trim()) setAddingItem(false); }}
                          />
                          <button
                            type="button"
                            className="ttm-icon-btn cal-focus"
                            aria-label="Add item"
                            disabled={!form.newItem.trim()}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={addChecklistItem}
                          >
                            <Check size={15} strokeWidth={2.4} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="ttm-add cal-focus" onClick={() => setAddingItem(true)}>
                          + Add item
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="ttm-sched">
                    <span className="ttm-caption">Schedule</span>
                    <Segmented
                      label="Schedule"
                      className="ttm-seg-4"
                      options={SCHED_OPTIONS}
                      value={form.sched}
                      onChange={setSched}
                    />

                    {form.freq === "WEEKLY" && (
                      <div role="group" aria-label="Days of week" className="ttm-days">
                        {DAYS_OF_WEEK.map((d) => (
                          <button
                            key={d.key}
                            type="button"
                            className="ttm-day cal-focus"
                            aria-pressed={form.selectedDays.includes(d.key)}
                            onClick={() => toggleDay(d.key)}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {form.sched !== "WEEKLY" && (
                      <div className="ttm-every">
                        <span>Repeat every</span>
                        <button
                          type="button"
                          className="ttm-step cal-focus"
                          aria-label="Fewer"
                          disabled={form.interval <= intervalMin}
                          onClick={() => setIntervalN(form.interval - 1)}
                        >
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <input
                          type="number"
                          min={intervalMin}
                          max={52}
                          aria-label={`Every how many ${intervalUnit}`}
                          className="ttm-num cal-mono"
                          value={form.interval}
                          onChange={(e) => setIntervalN(parseInt(e.target.value) || 1)}
                          onBlur={() => { if (form.interval < intervalMin) setIntervalN(intervalMin); }}
                        />
                        <button
                          type="button"
                          className="ttm-step cal-focus"
                          aria-label="More"
                          disabled={form.interval >= 52}
                          onClick={() => setIntervalN(form.interval + 1)}
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                        <span>{intervalUnit}</span>
                      </div>
                    )}

                    {phrase ? (
                      <span className="ttm-preview">
                        Creates one {cardTitle ? `“${cardTitle}” ` : ""}card {phrase} in {generatedColName}.
                      </span>
                    ) : (
                      <span className="ttm-preview" style={{ color: "var(--cal-station-fg)" }}>Pick at least one day.</span>
                    )}
                  </div>

                  <div className="ttm-foot">
                    {editing && (
                      <button
                        type="button"
                        className="ttm-del cal-focus"
                        aria-label="Delete template"
                        onClick={() => handleDelete(editing)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        <span className="ttm-del-text">Delete</span>
                      </button>
                    )}
                    <button type="button" className="ttm-btn cal-focus" onClick={() => setMode("list")}>Cancel</button>
                    <button type="button" className="ttm-primary cal-focus" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? "Saving…" : mode === "create" ? "Create template" : "Save template"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Scoped styles for the dialog. Every colour comes from the v2 --cal-* tokens
// (index.css), so html.dark works without overrides. Show/hide for the phone
// and tablet layouts lives here, never in inline styles.
const TTM_CSS = `
.ttm-overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,10,20,.45)}
.ttm-dialog{position:relative;width:min(1240px,100%);height:min(900px,calc(100dvh - 48px));display:flex;flex-direction:column;overflow:hidden;background:var(--cal-surface);color:var(--cal-ink);border:1px solid var(--cal-line);border-radius:28px;box-shadow:var(--cal-pop);outline:none}
.ttm-dialog[data-narrow]{width:min(600px,100%);height:auto;max-height:min(900px,calc(100dvh - 48px))}
.ttm-grab{display:none}
.ttm-head{flex:none;display:flex;align-items:center;gap:16px;padding:22px 28px;border-bottom:1px solid var(--cal-line)}
.ttm-eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--cal-muted)}
.ttm-h1{margin:0;font-size:26px;line-height:1.2;font-weight:600;color:var(--cal-ink)}
.ttm-sub{font-size:13px;color:var(--cal-ink-2)}
.ttm-pill{flex:none;display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 8px 0 18px;border-radius:999px;border:none;background:var(--cal-brand);color:#fff;font:inherit;font-size:14px;font-weight:600;white-space:nowrap;cursor:pointer}
.ttm-pill-plus{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.22);display:grid;place-items:center}
.ttm-pill:hover,.ttm-primary:hover:not(:disabled){filter:brightness(1.08)}
.ttm-close{flex:none;width:40px;height:40px;border-radius:12px;border:none;background:var(--cal-surface-2);color:var(--cal-ink-2);display:grid;place-items:center;cursor:pointer}
.ttm-close:hover{background:var(--cal-surface-3);color:var(--cal-ink)}

.ttm-body{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:460px minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
.ttm-body[data-single]{grid-template-columns:minmax(0,1fr)}
.ttm-list{min-height:0;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;background:var(--cal-board);border-right:1px solid var(--cal-line)}
.ttm-body[data-single] .ttm-list{border-right:none}
.ttm-form{min-height:0;overflow-y:auto;padding:24px 28px 0;display:flex;flex-direction:column;gap:16px;background:var(--cal-surface)}
.ttm-listbar{display:none}

.ttm-card{flex:none;background:var(--cal-surface);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:var(--cal-card-shadow)}
.ttm-card[data-selected]{outline:2px solid var(--cal-brand);outline-offset:-2px}
.ttm-card-top{display:flex;align-items:flex-start;gap:12px}
.ttm-icon{flex:none;width:40px;height:40px;border-radius:12px;background:var(--cal-brand-soft);color:var(--cal-brand-text);display:grid;place-items:center}
.ttm-card[data-paused] .ttm-icon{background:var(--cal-surface-2);color:var(--cal-muted)}
.ttm-name{font-size:15px;font-weight:600;color:var(--cal-ink);overflow-wrap:anywhere}
.ttm-cardtitle{font-size:13px;color:var(--cal-ink-2);overflow-wrap:anywhere}
.ttm-row{display:flex;flex-wrap:wrap;gap:6px;padding-left:52px}
.ttm-actions{display:flex;flex-wrap:wrap;gap:8px;padding-left:52px}
.ttm-tag{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:8px;font-size:12px;white-space:nowrap}
.ttm-count{display:inline-flex;align-items:center;font-size:12px;color:var(--cal-muted)}
.ttm-note{font-size:12px;line-height:1.5;color:var(--cal-muted);padding:4px 6px}
.ttm-skel{flex:none;height:136px;border-radius:18px;background:var(--cal-surface);box-shadow:var(--cal-card-shadow);animation:ttm-pulse 1.4s ease-in-out infinite}
@keyframes ttm-pulse{50%{opacity:.5}}
.ttm-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;color:var(--cal-ink-2);padding:48px 20px}

.ttm-switch{flex:none;position:relative;width:44px;height:26px;padding:0;border:none;border-radius:999px;background:var(--cal-line-2);cursor:pointer;transition:background-color .15s}
.ttm-switch[data-on]{background:var(--cal-leave-dot)}
.ttm-knob{position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .15s}
.ttm-switch[data-on] .ttm-knob{transform:translateX(18px)}

.ttm-sbtn{height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink);font:inherit;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}
.ttm-sbtn:hover{background:var(--cal-surface-2)}
.ttm-sbtn[data-ghost]{border-color:transparent;background:transparent;color:var(--cal-ink-2)}
.ttm-sbtn[data-ghost]:hover{background:var(--cal-surface-2);color:var(--cal-ink)}
.ttm-btn{height:44px;padding:0 18px;border-radius:12px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink);font:inherit;font-size:14px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;white-space:nowrap}
.ttm-btn:hover{background:var(--cal-surface-2)}
.ttm-primary{height:44px;padding:0 22px;border-radius:12px;border:none;background:var(--cal-brand);color:#fff;font:inherit;font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;white-space:nowrap}
.ttm-primary:disabled{opacity:.6;cursor:not-allowed}
.ttm-del{margin-right:auto;height:44px;padding:0 14px;border-radius:12px;border:none;background:transparent;color:var(--cal-station-fg);font:inherit;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.ttm-del:hover{background:var(--cal-station-bg)}
.ttm-del:disabled{opacity:.6;cursor:not-allowed}

.ttm-form-head{display:flex;align-items:center;gap:10px}
.ttm-form-title{margin:0;font-size:18px;font-weight:600;color:var(--cal-ink)}
.ttm-back{display:none;flex:none;width:36px;height:36px;border-radius:10px;border:none;background:var(--cal-surface-2);color:var(--cal-ink-2);place-items:center;cursor:pointer}
.ttm-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ttm-label,.ttm-caption{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--cal-muted)}
.ttm-label{display:flex;flex-direction:column;gap:6px;min-width:0}
.ttm-input{display:block;width:100%;min-width:0;height:42px;padding:0 12px;border-radius:12px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink);font:inherit;font-size:14px;font-weight:500;letter-spacing:0;text-transform:none;outline:none}
.ttm-input::placeholder{color:var(--cal-muted);font-weight:400}
.ttm-input:focus{border-color:var(--cal-brand);box-shadow:inset 0 0 0 1px var(--cal-brand)}
textarea.ttm-input{height:auto;padding:10px 12px;resize:none;background:var(--cal-surface-2);font-weight:400;line-height:1.45}
select.ttm-input{appearance:none;-webkit-appearance:none;padding-right:36px;cursor:pointer}
.dark .ttm-input,.dark .ttm-num{color-scheme:dark}
.ttm-select-chev{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--cal-muted);pointer-events:none}

.ttm-seg{display:grid;gap:4px;padding:4px;border-radius:12px;background:var(--cal-surface-3)}
.ttm-seg-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ttm-seg-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.ttm-seg button{height:34px;padding:0 6px;border-radius:9px;border:none;background:transparent;color:var(--cal-ink-2);font:inherit;font-size:13px;font-weight:400;letter-spacing:0;text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.ttm-seg-4 button{height:36px}
.ttm-seg button:hover{color:var(--cal-ink)}
.ttm-seg button[aria-checked="true"]{background:var(--cal-surface);color:var(--cal-ink);font-weight:600;box-shadow:var(--cal-shadow)}

.ttm-cl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.ttm-cl-item{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 6px 0 12px;border-radius:10px;background:var(--cal-surface-2);color:var(--cal-ink);font-size:14px}
.ttm-cl-item[data-dragging]{opacity:.45}
.ttm-cl-item[data-over]{box-shadow:inset 0 0 0 2px var(--cal-brand)}
.ttm-grip{flex:none;color:var(--cal-muted);cursor:grab}
.ttm-cl-label{flex:1;min-width:0;padding:8px 0;line-height:1.3;overflow-wrap:anywhere}
.ttm-icon-btn{flex:none;width:28px;height:28px;border-radius:8px;border:none;background:transparent;color:var(--cal-muted);display:grid;place-items:center;cursor:pointer}
.ttm-icon-btn:hover:not(:disabled){background:var(--cal-surface-3);color:var(--cal-ink)}
.ttm-icon-btn:disabled{opacity:.4;cursor:default}
.ttm-add{height:40px;border-radius:10px;border:1.5px dashed var(--cal-line-2);background:transparent;color:var(--cal-ink-2);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.ttm-add:hover{border-color:var(--cal-brand);color:var(--cal-brand-text)}
.ttm-add-row{display:flex;align-items:center;gap:4px;height:40px;padding-right:6px;border-radius:10px;border:2px solid var(--cal-brand);background:var(--cal-surface)}
.ttm-add-row input{flex:1;min-width:0;height:100%;padding:0 10px;border:none;background:transparent;color:var(--cal-ink);font:inherit;font-size:14px;outline:none}
.ttm-add-row input::placeholder{color:var(--cal-muted)}

.ttm-sched{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:16px;background:var(--cal-surface-2)}
.ttm-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.ttm-day{height:36px;padding:0;border-radius:9px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink-2);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
.ttm-day:hover{color:var(--cal-ink)}
.ttm-day[aria-pressed="true"]{background:var(--cal-brand);border-color:var(--cal-brand);color:#fff;font-weight:600}
.ttm-every{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:13px;color:var(--cal-ink-2)}
.ttm-step{flex:none;width:36px;height:36px;border-radius:9px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink);display:grid;place-items:center;cursor:pointer}
.ttm-step:hover:not(:disabled){background:var(--cal-surface-3)}
.ttm-step:disabled{opacity:.45;cursor:not-allowed}
.ttm-num{width:56px;height:36px;border-radius:9px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink);font-size:14px;font-weight:600;text-align:center;outline:none;-moz-appearance:textfield}
.ttm-num::-webkit-inner-spin-button,.ttm-num::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.ttm-num:focus{border-color:var(--cal-brand);box-shadow:inset 0 0 0 1px var(--cal-brand)}
.ttm-preview{font-size:13px;color:var(--cal-ink-2)}

.ttm-foot{position:sticky;bottom:0;z-index:1;display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:4px;padding:12px 0 24px;background:var(--cal-surface)}

/* Tablet: one pane at a time (list, then the form). */
@media (max-width:1099px){.ttm-body{grid-template-columns:380px minmax(0,1fr)}}
@media (max-width:959px){
  .ttm-body,.ttm-body[data-single]{grid-template-columns:minmax(0,1fr)}
  .ttm-body[data-view="list"] .ttm-form{display:none}
  .ttm-body[data-view="form"] .ttm-list{display:none}
  .ttm-list{border-right:none}
  .ttm-back{display:grid}
}
/* Phone: full-height bottom sheet, thumb-reachable action bars. */
@media (max-width:639px){
  .ttm-overlay{align-items:flex-end;padding:0}
  .ttm-dialog,.ttm-dialog[data-narrow]{width:100%;height:calc(100dvh - 8px - env(safe-area-inset-top));max-height:none;border-radius:24px 24px 0 0;border-bottom:none}
  .ttm-grab{display:block;flex:none;width:40px;height:4px;margin:8px auto 0;border-radius:2px;background:var(--cal-line-2)}
  .ttm-head{padding:8px 16px 14px;gap:12px;align-items:flex-start}
  .ttm-h1{font-size:22px}
  .ttm-head .ttm-pill{display:none}
  .ttm-list{padding:16px 16px 0}
  .ttm-body[data-single] .ttm-list{padding-bottom:calc(16px + env(safe-area-inset-bottom))}
  .ttm-listbar{display:block;position:sticky;bottom:0;margin:auto -16px 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:var(--cal-board);border-top:1px solid var(--cal-line)}
  .ttm-listbar .ttm-pill{width:100%;height:48px;justify-content:space-between}
  .ttm-form{padding:16px 16px 0}
  .ttm-grid2,.ttm-cl{grid-template-columns:minmax(0,1fr)}
  .ttm-seg-4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ttm-seg button,.ttm-seg-4 button,.ttm-day,.ttm-step,.ttm-num{height:40px}
  .ttm-step{width:40px}
  .ttm-input,.ttm-num,.ttm-add-row input{font-size:16px}
  .ttm-input{height:46px}
  .ttm-sbtn{height:40px}
  .ttm-icon-btn{width:36px;height:36px}
  .ttm-cl-item{min-height:46px}
  .ttm-add,.ttm-add-row{height:46px}
  .ttm-foot{margin:auto -16px 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--cal-line)}
  .ttm-foot .ttm-btn,.ttm-foot .ttm-primary{flex:1;padding:0 12px;height:48px}
  .ttm-del{height:48px;padding:0 12px;margin-right:0}
  .ttm-del-text{display:none}
}
@media (prefers-reduced-motion:reduce){.ttm-skel{animation:none}.ttm-knob,.ttm-switch{transition:none}}
`;
