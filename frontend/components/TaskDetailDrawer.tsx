import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { useUserRole } from "@/lib/rbac";
import { getNextShiftDate, getShiftForDate } from "@/lib/shiftRota";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import {
  X, Trash2, Repeat, Plus, Clock, User, ImageIcon, Search, Upload, Key, Check, ChevronDown, Loader2,
} from "lucide-react";
import { TASK_LABELS, CARD_COVERS, getCoverStyle } from "@/lib/taskLabels";
import { canEditTaskDetails, describeRRule, priorityKey } from "@/lib/taskUi";
import type { Task, TaskColumn, ChecklistItem, TaskCategory, TaskPriority } from "~backend/task/types";

interface TaskDetailDrawerProps {
  task: Task | null;
  columns: TaskColumn[];
  onClose: () => void;
  onDelete?: (taskId: number) => void;
  canEdit?: boolean;
  isNewTask?: boolean;
  onCompleted?: (task: Task) => void;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "High", label: "High" },
  { value: "Med",  label: "Medium" },
  { value: "Low",  label: "Low" },
];

const CATEGORY_OPTIONS: TaskCategory[] = ["Training", "Inspection", "HFSV", "Admin", "Other"];

const RRULE_PRESETS = [
  { label: "None",            value: "__none__" },
  { label: "Daily",           value: "FREQ=DAILY;INTERVAL=1" },
  { label: "Every Monday",    value: "FREQ=WEEKLY;BYDAY=MO" },
  { label: "Every Tuesday",   value: "FREQ=WEEKLY;BYDAY=TU" },
  { label: "Every Wednesday", value: "FREQ=WEEKLY;BYDAY=WE" },
  { label: "Every Thursday",  value: "FREQ=WEEKLY;BYDAY=TH" },
  { label: "Every Friday",    value: "FREQ=WEEKLY;BYDAY=FR" },
  { label: "Every Saturday",  value: "FREQ=WEEKLY;BYDAY=SA" },
  { label: "Every Sunday",    value: "FREQ=WEEKLY;BYDAY=SU" },
  { label: "Mon–Fri",         value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Weekly",          value: "FREQ=WEEKLY;INTERVAL=1" },
  { label: "Fortnightly",     value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Monthly",         value: "FREQ=MONTHLY;INTERVAL=1" },
  { label: "Custom…",         value: "__custom__" },
];

const WEEKDAYS = [
  { code: "MO", short: "M", name: "Monday" },
  { code: "TU", short: "T", name: "Tuesday" },
  { code: "WE", short: "W", name: "Wednesday" },
  { code: "TH", short: "T", name: "Thursday" },
  { code: "FR", short: "F", name: "Friday" },
  { code: "SA", short: "S", name: "Saturday" },
  { code: "SU", short: "S", name: "Sunday" },
];

const COVER_TABS = [
  { id: "colours", label: "Colours" },
  { id: "upload", label: "Upload" },
  { id: "unsplash", label: "Unsplash" },
] as const;

function parseRRuleLabel(rrule?: string): string {
  if (!rrule || rrule === "__none__") return "None";
  const p = RRULE_PRESETS.find((p) => p.value === rrule && p.value !== "__custom__" && p.value !== "__none__");
  return p ? p.label : "Custom";
}

const WATCHES = ["Amber", "Green", "Blue", "Red", "White"];

/** Radix select items in the v2 style (the content gets .cal-menu). */
const ITEM_CLS = "rounded-[10px] py-2 pl-3 text-sm focus:bg-[var(--cal-surface-2)] focus:text-[var(--cal-ink)]";

/* Styles for this panel (v2 tokens only, so dark mode follows html.dark).
   Plain CSS so hover / pressed / disabled states sit next to the base look.
   None of these set `display` on anything that uses a Tailwind show/hide class. */
const CSS = `
.tdd-lbl{font-size:12px;font-weight:600;color:var(--cal-muted);letter-spacing:.06em;text-transform:uppercase}
.tdd-k{font-size:11px;font-weight:600;color:var(--cal-muted);letter-spacing:.04em;text-transform:uppercase;line-height:1.2}
.tdd-v{font-size:14px;font-weight:600;line-height:1.3}
.tdd-title{width:100%;background:transparent;border:none;border-bottom:2px solid transparent;border-radius:0;padding:0 0 4px;outline:none;resize:none;overflow:hidden;font-size:24px;font-weight:600;letter-spacing:-.01em;line-height:1.25;color:var(--cal-ink);transition:border-color .15s}
.tdd-title:hover:not(:disabled){border-bottom-color:var(--cal-line-2)}
.tdd-title:focus{border-bottom-color:var(--cal-brand)}
@media (min-width:640px){.tdd-title{font-size:28px}}
.tdd-area{width:100%;border-radius:14px;border:1px solid var(--cal-line);background:var(--cal-surface-2);color:var(--cal-ink);font-size:14px;line-height:1.5;padding:12px 14px;resize:none;outline:none;transition:border-color .15s}
.tdd-area:focus{border-color:var(--cal-brand)}
.tdd-title::placeholder,.tdd-area::placeholder{color:var(--cal-muted)}
.tdd-title:disabled,.tdd-area:disabled{opacity:1;-webkit-text-fill-color:currentColor}
.tdd-field{width:100%;height:42px;border-radius:12px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink);font-size:14px;padding:0 12px;gap:8px;box-shadow:none;text-align:left;cursor:pointer;transition:background-color .15s}
.tdd-field:hover:not(:disabled){background:var(--cal-surface-2)}
.tdd-field:disabled{cursor:default;opacity:.7}
.tdd-field>svg:last-child{width:14px;height:14px;opacity:1;color:var(--cal-muted)}
.tdd-tile{width:100%;min-height:56px;height:auto;border-radius:14px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink);padding:8px 12px;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;text-align:left;box-shadow:none;white-space:normal;cursor:pointer}
.tdd-tile:disabled{cursor:default;opacity:.7}
.tdd-tile>svg:last-child{display:none}
.tdd-due:has(input:focus-visible){outline:2px solid var(--cal-brand);outline-offset:2px}
.tdd-chip{flex:none;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink-2);font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background-color .15s}
.tdd-chip:hover:not(:disabled){background:var(--cal-surface-2)}
.tdd-chip[aria-pressed="true"]{border:2px solid var(--cal-ink);background:var(--cal-surface-2);color:var(--cal-ink);font-weight:600;padding:0 11px}
.tdd-chip:disabled{cursor:default}
@media (min-width:640px){.tdd-chip{height:32px;padding:0 11px}.tdd-chip[aria-pressed="true"]{padding:0 10px}}
.tdd-seg{display:grid;gap:4px;padding:4px;border-radius:12px;background:var(--cal-surface-3)}
.tdd-seg-btn{height:34px;border-radius:9px;border:none;background:transparent;color:var(--cal-ink-2);font-size:13px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer}
.tdd-seg-btn:hover:not(:disabled){color:var(--cal-ink)}
.tdd-seg-btn:disabled{cursor:default}
.tdd-seg-btn[aria-checked="true"],.tdd-seg-btn[aria-selected="true"]{background:var(--cal-surface);color:var(--cal-ink);font-weight:600;box-shadow:var(--cal-shadow)}
.tdd-day{height:38px;padding:0;border-radius:10px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink-2);font-size:13px;font-weight:600;cursor:pointer}
.tdd-day[aria-pressed="true"]{border-color:transparent;background:var(--cal-brand);color:#ffffff}
.tdd-num{width:48px;height:28px;padding:0 4px;border-radius:6px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink);font-size:13px;text-align:center;outline:none}
.tdd-num:focus{border-color:var(--cal-brand)}
.dark .tdd-num{color-scheme:dark}
.tdd-soft{border:none;background:var(--cal-surface-2);color:var(--cal-ink-2);cursor:pointer;transition:background-color .15s}
.tdd-soft:hover{background:var(--cal-surface-3);color:var(--cal-ink)}
.tdd-soft[aria-expanded="true"]{background:var(--cal-brand-soft);color:var(--cal-brand-text)}
.tdd-ghost{border:none;background:transparent;cursor:pointer;transition:background-color .15s}
.tdd-ghost:hover:not(:disabled){background:var(--cal-surface-2)}
.tdd-danger{border:none;background:transparent;color:var(--cal-station-fg);cursor:pointer;transition:background-color .15s}
.tdd-danger:hover{background:var(--cal-station-bg)}
.tdd-primary{border:none;background:var(--cal-brand);color:#ffffff;font-weight:600;cursor:pointer;white-space:nowrap}
.tdd-primary:hover:not(:disabled){filter:brightness(1.08)}
.tdd-primary:disabled{opacity:.45;cursor:default}
.tdd-onimg{border:none;background:rgba(255,255,255,.92);color:#111427;cursor:pointer}
.tdd-onimg:hover{background:#ffffff}
.tdd-drop{border:1.5px dashed var(--cal-line-2);background:transparent;color:var(--cal-ink-2);cursor:pointer;transition:all .15s}
.tdd-drop:hover{border-color:var(--cal-brand);color:var(--cal-brand-text);background:var(--cal-brand-soft)}
.tdd-pill{height:28px;padding:0 10px;border-radius:999px;border:1px solid var(--cal-line-2);background:var(--cal-surface);color:var(--cal-ink-2);font-size:12px;cursor:pointer}
.tdd-pill:hover{border-color:transparent;background:var(--cal-brand-soft);color:var(--cal-brand-text)}
.tdd-swatch{cursor:pointer;transition:transform .12s}
.tdd-swatch:hover{transform:scale(1.05)}
.tdd-row{border-radius:10px;transition:background-color .12s}
.tdd-box{flex:none;border-radius:7px;border:2px solid var(--cal-line-2);background:var(--cal-surface)}
.tdd-box[data-on]{border:none;background:var(--cal-brand)}
.tdd-del{flex:none;width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--cal-muted);cursor:pointer;transition:opacity .12s}
.tdd-del:hover{color:var(--cal-station-fg);background:var(--cal-station-bg)}
@media (hover:hover){.tdd-row:hover{background:var(--cal-surface-2)}}
@media (hover:hover) and (min-width:640px){.tdd-del{opacity:0}.tdd-row:hover .tdd-del,.tdd-del:focus-visible{opacity:1}}
.tdd-noscroll{scrollbar-width:none}
.tdd-noscroll::-webkit-scrollbar{display:none}
.tdd-pop{box-shadow:var(--cal-card-shadow)}
@media (min-width:640px){.tdd-pop{box-shadow:var(--cal-pop)}}
`;

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden="true" style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", flex: "none", background: color }} />;
}

/** Uppercase label above a control, as in the design's right rail. */
function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? <label htmlFor={htmlFor} className="tdd-lbl">{label}</label> : <span className="tdd-lbl">{label}</span>}
      {children}
      {hint}
    </div>
  );
}

function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={className} aria-hidden="true" style={{ height: 6, borderRadius: 3, background: "var(--cal-surface-3)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: pct === 100 ? "var(--cal-leave-dot)" : "var(--cal-brand)", transition: "width .3s" }} />
    </div>
  );
}

export default function TaskDetailDrawer({ task, columns, onClose, onDelete, canEdit: canWork = false, isNewTask = false, onCompleted }: TaskDetailDrawerProps) {
  const { user } = useAuth();
  const userRole = useUserRole();
  // canWork (the prop): move it between columns and tick its checklist — anyone
  // on the watch. canEdit: change its details — only who the server allows,
  // so nobody is offered a change that would then be refused.
  const canEdit = canWork && (isNewTask || canEditTaskDetails(task as any, user, userRole));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Med");
  const [category, setCategory] = useState<TaskCategory>("Other");
  const [dueDate, setDueDate] = useState("");
  const [rrule, setRrule] = useState("");
  const [customRrule, setCustomRrule] = useState("");
  const [showCustomRrule, setShowCustomRrule] = useState(false);
  const [watchUnit, setWatchUnit] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [coverColour, setCoverColour] = useState<string>("");
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [coverTab, setCoverTab] = useState<"colours" | "upload" | "unsplash">("colours");
  const [unsplashKey, setUnsplashKey] = useState<string>(() => localStorage.getItem("unsplash-access-key") ?? "");
  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [unsplashResults, setUnsplashResults] = useState<{ id: string; thumb: string; full: string; alt: string }[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLElement>(null);
  const focusedNewRef = useRef<number | null>(null);

  const resetFields = () => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setCategory(task.category);
    setDueDate(
      task.due_at
        ? new Date(task.due_at).toISOString().split("T")[0]
        : isNewTask ? getNextShiftDate(user?.watch_unit) : ""
    );
    setRrule(task.rrule ?? "__none__");
    setCustomRrule(task.rrule ?? "");
    setShowCustomRrule(!!task.rrule && !RRULE_PRESETS.some((p) => p.value === task.rrule && p.value !== "__custom__" && p.value !== "__none__"));
    setChecklist(task.checklist ? [...task.checklist] : []);
    setTags(task.tags ?? []);
    setWatchUnit((task as any).watch_unit ?? "");
    setCoverColour((task as any).cover_colour ?? "");
    setAddingItem(false);
    setNewChecklistItem("");
    setShowCoverPicker(false);
  };
  useEffect(resetFields, [task?.id]);

  // The title grows with its text (one line until it wraps).
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  }, [title, task?.id]);

  // A brand-new task opens with its placeholder title selected, ready to type over.
  useEffect(() => {
    if (!task || !isNewTask || !canEdit || focusedNewRef.current === task.id || title !== task.title) return;
    focusedNewRef.current = task.id;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [task?.id, isNewTask, canEdit, title]);

  // On phones the cover picker opens inline, further down the sheet — bring it into view.
  useEffect(() => {
    if (!showCoverPicker) return;
    const el = pickerRef.current;
    if (el && window.matchMedia("(max-width: 639.98px)").matches) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [showCoverPicker]);

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => backend.task.update(task!.id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err: Error) => {
      toast({
        title: "That change wasn't saved",
        description: /permission/i.test(err.message ?? "")
          ? "Only the person who set this task, the person it's assigned to, or a WC/CC on its watch can change that."
          : err.message || "Please try again.",
        variant: "destructive",
      });
      resetFields(); // put back what's really saved
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => backend.task.deleteTask(task!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onDelete?.(task!.id);
      onClose();
      toast({ title: "Task deleted" });
    },
    onError: (err: Error) => toast({ title: "Couldn't delete the task", description: err.message, variant: "destructive" }),
  });

  if (!task) return null;

  const save = async (updates: any) => {
    setSaving(true);
    try { await updateMutation.mutateAsync(updates); }
    finally { setSaving(false); }
  };

  const isDoneStatus = (k: string) => {
    if (k === "Done") return true;
    const name = columns.find((c) => c.status_key === k)?.name.toLowerCase() ?? "";
    return name.includes("done") || name.includes("complete");
  };

  const handleTitleBlur = () => { if (title.trim() && title !== task.title) save({ title: title.trim() }); };
  const handleDescriptionBlur = () => { if (description !== (task.description ?? "")) save({ description }); };

  const handleStatusChange = (val: string) => {
    const wasDone = isDoneStatus(task.status);
    const nowDone = isDoneStatus(val);
    setStatus(val);
    save({ status: val });
    if (!wasDone && nowDone) onCompleted?.(task);
  };

  const handlePriorityChange = (v: string) => { setPriority(v as TaskPriority); save({ priority: v }); };
  const handleCategoryChange = (v: string) => { setCategory(v as TaskCategory); save({ category: v }); };

  const handleDueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDueDate(e.target.value);
    save({ due_date: e.target.value ? new Date(e.target.value) : undefined });
  };

  const handleRecurrenceChange = (val: string) => {
    if (val === "__custom__") { setShowCustomRrule(true); setRrule("__custom__"); return; }
    setShowCustomRrule(false); setRrule(val);
    save({ rrule: val === "__none__" ? "" : val }); // "" clears it (undefined would be dropped from the request)
  };

  const handleWatchChange = (v: string) => {
    const val = v === "__none__" ? "" : v;
    setWatchUnit(val);
    save({ watch_unit: val || null });
    toast({ title: "Task moved", description: val ? `Moved to ${val} Watch` : "Watch cleared" });
  };

  const handleTagToggle = (id: string) => {
    const updated = tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id];
    setTags(updated);
    save({ tags: updated });
  };

  const handleCoverChange = (colour: string) => {
    setCoverColour(colour);
    setShowCoverPicker(false);
    save({ cover_colour: colour || null });
  };

  const handleSaveUnsplashKey = () => {
    const trimmed = keyDraft.trim();
    setUnsplashKey(trimmed);
    localStorage.setItem("unsplash-access-key", trimmed);
    setShowKeyInput(false);
    setKeyDraft("");
  };

  const handleUnsplashSearch = async (query: string = unsplashQuery) => {
    if (!unsplashKey || !query.trim()) return;
    setUnsplashLoading(true);
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape&client_id=${unsplashKey}`
      );
      if (!res.ok) throw new Error("Unsplash API error");
      const data = await res.json();
      setUnsplashResults((data.results ?? []).map((p: any) => ({
        id: p.id,
        thumb: p.urls.small,
        full: p.urls.regular,
        alt: p.alt_description ?? p.description ?? "Photo",
      })));
    } catch {
      toast({ title: "Unsplash error", description: "Check your API key or try again", variant: "destructive" });
    } finally {
      setUnsplashLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Resize to 800×300 (Trello card cover dimensions) using canvas
      const canvas = document.createElement("canvas");
      canvas.width = 800; canvas.height = 300;
      const ctx = canvas.getContext("2d")!;
      // Cover-fit: scale to fill, centre-crop
      const scale = Math.max(800 / img.width, 300 / img.height);
      const sw = 800 / scale, sh = 300 / scale;
      const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 800, 300);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      handleCoverChange(dataUrl);
    };
    img.src = url;
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleChecklistToggle = (idx: number) => {
    const updated = checklist.map((item, i) => i === idx ? { ...item, done: !item.done } : item);
    setChecklist(updated);
    save({ checklist: updated });
  };

  const handleChecklistDelete = (idx: number) => {
    const updated = checklist.filter((_, i) => i !== idx);
    setChecklist(updated);
    save({ checklist: updated });
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const updated = [...checklist, { label: newChecklistItem.trim(), done: false }];
    setChecklist(updated);
    save({ checklist: updated });
    setNewChecklistItem("");
    newItemInputRef.current?.focus();
  };

  const cancelAddItem = () => { setAddingItem(false); setNewChecklistItem(""); };

  const handleDelete = () => {
    if (confirm(`Delete "${task.title}"? This cannot be undone.`)) deleteMutation.mutate();
  };

  // Custom repeat: weekday toggles + "every N weeks" build the same RRULE text
  // that the rule box below them edits directly.
  const customDays = customRrule.match(/BYDAY=([^;]+)/)?.[1]?.split(",").filter(Boolean) ?? [];
  const customInterval = Math.max(1, parseInt(customRrule.match(/INTERVAL=(\d+)/)?.[1] ?? "1", 10) || 1);
  const applyWeekly = (days: string[], interval: number) => {
    const ordered = WEEKDAYS.map((d) => d.code).filter((c) => days.includes(c));
    const rule = `FREQ=WEEKLY;INTERVAL=${interval}${ordered.length ? `;BYDAY=${ordered.join(",")}` : ""}`;
    setCustomRrule(rule);
    save({ rrule: rule });
  };

  const onPriorityKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canEdit || !["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const i = (PRIORITY_OPTIONS.findIndex((p) => p.value === priority) + step + PRIORITY_OPTIONS.length) % PRIORITY_OPTIONS.length;
    handlePriorityChange(PRIORITY_OPTIONS[i].value);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[i]?.focus();
  };

  // ── Derived display values ────────────────────────────────────────────────
  const uid = `tdd-${task.id}`;
  const completedCount = checklist.filter((i) => i.done).length;
  const checklistPct = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  const dueDateObj = dueDate ? new Date(dueDate + "T12:00:00") : null;
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const diffDays = dueDateObj
    ? Math.round((new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate()).getTime() - today0.getTime()) / 86400000)
    : null;
  const isOverdue = diffDays !== null && diffDays < 0 && !isDoneStatus(status);
  const isDueToday = diffDays === 0;

  // "Next Blue Watch shift · 1st Day" — from the watch's rota.
  const hintWatch = watchUnit || user?.watch_unit || "";
  const shiftOnDue = dueDateObj && hintWatch ? getShiftForDate(hintWatch, dueDateObj) : null;
  const isNextShift = !!shiftOnDue?.isWorking && (diffDays ?? 0) > 0 && dueDate === getNextShiftDate(hintWatch);
  const shiftHint = shiftOnDue?.isWorking ? `${isNextShift ? "Next " : ""}${hintWatch} Watch${isNextShift ? " shift" : ""} · ${shiftOnDue.shiftType}` : null;
  const dueTone = isOverdue ? "station" : isDueToday ? "day" : isNextShift ? "night" : null;
  const dueBorder = dueTone ? { border: `2px solid var(--cal-${dueTone}-dot)` } : undefined;
  const dueHintText = [isOverdue ? `Overdue ${Math.abs(diffDays!)}d` : isDueToday ? "Due today" : null, shiftHint].filter(Boolean).join(" · ");
  const dueHint = dueHintText ? (
    <span style={{ fontSize: 11, fontWeight: 600, color: `var(--cal-${dueTone ?? "night"}-fg)` }}>{dueHintText}</span>
  ) : null;
  const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const phoneDueText = !dueDateObj ? "No date"
    : isDueToday ? `Today · ${shortDate(dueDateObj)}`
    : isOverdue ? `Overdue · ${shortDate(dueDateObj)}`
    : dueDateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  const currentRruleVal = showCustomRrule ? "__custom__" : (rrule || "__none__");
  const recurLabel = parseRRuleLabel(showCustomRrule ? customRrule : rrule);
  const recurText = describeRRule(showCustomRrule ? task.rrule : rrule && rrule !== "__none__" ? rrule : null);
  const coverStyle = getCoverStyle(coverColour);
  const statusCol = columns.find((c) => c.status_key === status);
  const firstColKey = [...columns].sort((a, b) => a.position - b.position)[0]?.status_key;
  const statusTone = isDoneStatus(status)
    ? { bg: "var(--cal-leave-bg)", fg: "var(--cal-leave-fg)" }
    : status === "NotStarted" || status === firstColKey
      ? { bg: "var(--cal-surface-2)", fg: "var(--cal-ink-2)" }
      : { bg: "var(--cal-brand-soft)", fg: "var(--cal-brand-text)" };
  const priorityText = PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? "Medium";

  // ── Shared select pieces (desktop rail and phone sheet use different triggers) ──
  const columnItems = columns.map((col) => (
    <SelectItem key={col.id} value={col.status_key} className={ITEM_CLS}>
      <span className="flex items-center gap-2"><Dot color={col.color} />{col.name}</span>
    </SelectItem>
  ));
  const priorityItems = PRIORITY_OPTIONS.map((p) => (
    <SelectItem key={p.value} value={p.value} className={ITEM_CLS}>
      <span className="flex items-center gap-2"><Dot color={`var(--cal-${priorityKey(p.value)}-dot)`} />{p.label}</span>
    </SelectItem>
  ));

  const categorySelect = (id: string) => (
    <Select value={category} onValueChange={handleCategoryChange} disabled={!canEdit}>
      <SelectTrigger id={id} className="tdd-field cal-focus"><SelectValue /></SelectTrigger>
      <SelectContent className="cal-menu">
        {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c} className={ITEM_CLS}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const watchSelect = (id: string) => (
    <Select value={watchUnit || "__none__"} onValueChange={handleWatchChange}>
      <SelectTrigger id={id} className="tdd-field cal-focus"><SelectValue placeholder="Assign watch…" /></SelectTrigger>
      <SelectContent className="cal-menu">
        <SelectItem value="__none__" className={ITEM_CLS}>— None —</SelectItem>
        {WATCHES.map((w) => <SelectItem key={w} value={w} className={ITEM_CLS}>{w} Watch</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const recurrenceSelect = (id: string, look: "field" | "compact" | "tile") => (
    <Select value={currentRruleVal} onValueChange={handleRecurrenceChange} disabled={!canEdit}>
      <SelectTrigger
        id={id}
        className={`${look === "tile" ? "tdd-tile" : "tdd-field"} cal-focus`}
        style={look === "compact" ? { width: "auto", height: 34, borderRadius: 10, fontSize: 13, fontWeight: 600, padding: "0 10px" } : undefined}
      >
        {look === "tile" && <span className="tdd-k">Repeats</span>}
        <SelectValue>{look === "tile" ? <span className="tdd-v">{recurLabel}</span> : recurLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent className="cal-menu">
        {RRULE_PRESETS.map((p) => <SelectItem key={p.value} value={p.value} className={ITEM_CLS}>{p.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const customPanel = (header: React.ReactNode) => (
    <div className="flex flex-col gap-2" style={{ padding: 14, borderRadius: 16, background: "var(--cal-surface-2)" }}>
      {header}
      <div role="group" aria-label="Repeat on" className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {WEEKDAYS.map((d) => {
          const on = customDays.includes(d.code);
          return (
            <button
              key={d.code}
              type="button"
              aria-pressed={on}
              aria-label={d.name}
              title={d.name}
              className="tdd-day cal-mono cal-focus"
              onClick={() => applyWeekly(on ? customDays.filter((c) => c !== d.code) : [...customDays, d.code], customInterval)}
            >
              {d.short}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--cal-ink-2)" }}>
        Every
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={52}
          aria-label="Repeat every how many weeks"
          className="tdd-num cal-mono"
          value={customInterval}
          onChange={(e) => { const n = parseInt(e.target.value, 10); if (n >= 1 && n <= 52) applyWeekly(customDays, n); }}
        />
        {customInterval === 1 ? "week" : "weeks"}
      </div>
      <div className="flex gap-1.5">
        <input
          className="cal-field cal-mono flex-1 min-w-0"
          style={{ height: 34, fontSize: 12, background: "var(--cal-surface)" }}
          aria-label="Custom repeat rule"
          placeholder="FREQ=WEEKLY;BYDAY=TU"
          value={customRrule}
          onChange={(e) => setCustomRrule(e.target.value)}
        />
        <button type="button" className="tdd-primary cal-focus" style={{ height: 34, padding: "0 12px", borderRadius: 10, fontSize: 12 }} onClick={() => save({ rrule: customRrule.trim() })}>
          Save
        </button>
      </div>
    </div>
  );

  const closeButtonCls = `tdd-soft cal-focus grid place-items-center flex-none ml-auto sm:ml-0 h-10 w-10 rounded-[12px] sm:h-9 sm:w-9 sm:rounded-[10px]${coverStyle ? " sm:hidden" : ""}`;

  // Portalled to <body> so it sits above the phone bottom nav (same z-index).
  return createPortal(
    <>
      <style>{CSS}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: "rgba(10,12,24,.45)" }} onClick={onClose} aria-hidden="true" />

      {/* Panel — centred on desktop, a bottom sheet on phones (v2 design). */}
      <div className="cal-ui fixed inset-0 z-50 flex items-end sm:items-start justify-center overflow-y-auto sm:py-10 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title || "Task"}
          className="cal-panel relative w-full sm:max-w-[860px] flex flex-col overflow-hidden sm:overflow-visible rounded-t-[28px] sm:rounded-[26px] max-h-[calc(100dvh_-_52px)] sm:max-h-none sm:border"
          style={{ background: "var(--cal-surface)", borderColor: "var(--cal-line)", boxShadow: "var(--cal-pop)", color: "var(--cal-ink)" }}
        >
          {canEdit && <input ref={fileInputRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true" onChange={handleFileUpload} />}

          {/* ── Cover strip (phones: grab handle; desktop: Cover + Close) ── */}
          {coverStyle ? (
            <div className="relative flex-none h-16 sm:h-24 sm:rounded-t-[25px]" style={coverStyle}>
              <div className="sm:hidden flex justify-center pt-2" aria-hidden="true">
                <span style={{ width: 40, height: 5, borderRadius: 3, background: "rgba(255,255,255,.6)" }} />
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="tdd-onimg cal-focus hidden sm:inline-flex items-center gap-1.5"
                  style={{ position: "absolute", right: 64, top: 14, height: 36, padding: "0 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: showCoverPicker ? "0 0 0 2px #ffffff" : undefined }}
                  aria-haspopup="dialog"
                  aria-expanded={showCoverPicker}
                  onClick={() => setShowCoverPicker(!showCoverPicker)}
                >
                  <ImageIcon className="h-[15px] w-[15px]" /> Cover
                </button>
              )}
              <button
                type="button"
                aria-label="Close"
                className="tdd-onimg cal-focus hidden sm:grid place-items-center"
                style={{ position: "absolute", right: 14, top: 14, width: 36, height: 36, borderRadius: 10 }}
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="sm:hidden flex-none flex justify-center pt-2" aria-hidden="true">
              <span style={{ width: 40, height: 5, borderRadius: 3, background: "var(--cal-line-2)" }} />
            </div>
          )}

          {/* ── Body ─────────────────────────────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain sm:overflow-visible flex flex-col gap-3.5 sm:gap-[18px] px-[18px] pt-3.5 pb-[max(20px,env(safe-area-inset-bottom))] sm:px-7 sm:pt-5 sm:pb-[26px]">

            {/* Status row */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <span className="cal-mono hidden sm:inline" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--cal-muted)" }}>TASK</span>
              {statusCol && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 999, flex: "none", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", background: statusTone.bg, color: statusTone.fg }}>
                  <Dot color={statusCol.color} size={7} />
                  {statusCol.name}
                </span>
              )}
              {recurText && (
                <span className="hidden sm:inline-flex items-center gap-1 min-w-0" style={{ fontSize: 12, color: "var(--cal-brand-text)", whiteSpace: "nowrap" }}>
                  <Repeat className="h-[13px] w-[13px] flex-none" strokeWidth={2.2} />
                  Recurring · {recurText}
                </span>
              )}
              {canEdit && (
                <span aria-live="polite" className="inline-flex items-center gap-1.5 sm:ml-auto flex-none" style={{ fontSize: 12, color: saving ? "var(--cal-brand-text)" : "var(--cal-muted)", fontWeight: saving ? 500 : 400 }}>
                  {saving ? (
                    <><Loader2 className="h-[13px] w-[13px] animate-spin" strokeWidth={2.4} />Saving…</>
                  ) : (
                    <><span className="hidden sm:inline-block" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cal-leave-dot)" }} />Saved</>
                  )}
                </span>
              )}
              {canEdit && !coverStyle && (
                <button
                  type="button"
                  aria-label="Add cover"
                  title="Add cover"
                  aria-haspopup="dialog"
                  aria-expanded={showCoverPicker}
                  className="tdd-soft cal-focus hidden sm:grid place-items-center flex-none"
                  style={{ width: 36, height: 36, borderRadius: 10 }}
                  onClick={() => setShowCoverPicker(!showCoverPicker)}
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
              )}
              <button type="button" aria-label="Close" className={closeButtonCls} onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Title */}
            <textarea
              ref={titleRef}
              aria-label="Task title"
              className="tdd-title sm:-mt-1.5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              rows={1}
              disabled={!canEdit}
              placeholder="Task title"
            />
            {canWork && !canEdit && (
              <p className="text-xs" style={{ margin: 0, color: "var(--cal-muted)" }}>
                You can move this card and tick its checklist. Its details can only be changed by the person who set it, the person it's assigned to, or a WC/CC on its watch.
              </p>
            )}

            <div className="flex flex-col gap-3.5 sm:grid sm:grid-cols-[minmax(0,1fr)_220px] md:grid-cols-[minmax(0,1fr)_260px] sm:gap-7 sm:items-start">

              {/* ── Main column (phones: everything, in the sheet's order) ── */}
              <div className="flex flex-col gap-3.5 sm:gap-[18px] min-w-0">

                {/* Labels — one scrolling row on phones */}
                {(canEdit || tags.length > 0) && (
                  <div className="order-1 flex flex-col gap-2">
                    <span className="tdd-lbl hidden sm:block">Labels</span>
                    <div role="group" aria-label="Labels" className="tdd-noscroll flex gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-[18px] px-[18px] py-1 -my-1 sm:mx-0 sm:px-0">
                      {TASK_LABELS.map((label) => (
                        <button
                          key={label.id}
                          type="button"
                          aria-pressed={tags.includes(label.id)}
                          disabled={!canEdit}
                          className="tdd-chip cal-focus"
                          onClick={() => handleTagToggle(label.id)}
                        >
                          <Dot color={label.colour} />
                          {label.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phones: Column / Priority / Due / Repeats tiles */}
                <div className="order-2 sm:hidden flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={status} onValueChange={handleStatusChange} disabled={!canWork}>
                      <SelectTrigger className="tdd-tile cal-focus">
                        <span className="tdd-k">Column</span>
                        <SelectValue><span className="tdd-v">{statusCol?.name ?? status}</span></SelectValue>
                      </SelectTrigger>
                      <SelectContent className="cal-menu">{columnItems}</SelectContent>
                    </Select>
                    <Select value={priority} onValueChange={handlePriorityChange} disabled={!canEdit}>
                      <SelectTrigger className="tdd-tile cal-focus">
                        <span className="tdd-k">Priority</span>
                        <SelectValue><span className="tdd-v" style={{ color: `var(--cal-${priorityKey(priority)}-fg)` }}>{priorityText}</span></SelectValue>
                      </SelectTrigger>
                      <SelectContent className="cal-menu">{priorityItems}</SelectContent>
                    </Select>
                    <label className="tdd-tile tdd-due relative flex" style={{ ...dueBorder, cursor: canEdit ? "pointer" : "default" }}>
                      <span className="tdd-k">Due</span>
                      <span className={`tdd-v${dueDateObj ? " cal-mono" : ""}`} style={{ color: dueTone && dueTone !== "night" ? `var(--cal-${dueTone}-fg)` : dueDateObj ? "var(--cal-ink)" : "var(--cal-muted)" }}>
                        {phoneDueText}
                      </span>
                      <input
                        type="date"
                        aria-label="Due date"
                        className="absolute inset-0 h-full w-full opacity-0"
                        style={{ cursor: canEdit ? "pointer" : "default" }}
                        value={dueDate}
                        onChange={handleDueChange}
                        disabled={!canEdit}
                      />
                    </label>
                    {recurrenceSelect(`${uid}-rec-m`, "tile")}
                  </div>
                  {dueHint}
                  {showCustomRrule && canEdit && customPanel(<span className="tdd-lbl">Custom repeat</span>)}
                </div>

                {/* Checklist */}
                {(canEdit || checklist.length > 0) && (
                  <div className="order-3 flex flex-col gap-2">
                    {checklist.length === 0 && !addingItem ? (
                      <div className="flex flex-col items-center gap-1" style={{ padding: 14, borderRadius: 14, border: "1.5px dashed var(--cal-line-2)" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cal-ink-2)" }}>No checklist yet</span>
                        <button
                          type="button"
                          className="tdd-ghost cal-focus inline-flex items-center gap-1.5"
                          style={{ height: 36, padding: "0 10px", borderRadius: 10, color: "var(--cal-brand-text)", fontSize: 13, fontWeight: 600 }}
                          onClick={() => setAddingItem(true)}
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} /> Add an item
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5">
                          <span className="tdd-lbl">Checklist</span>
                          {checklist.length > 0 && (
                            <>
                              <span className="cal-mono" style={{ fontSize: 12, color: "var(--cal-ink-2)" }} aria-label={`${completedCount} of ${checklist.length} done`}>
                                {completedCount}/{checklist.length}
                              </span>
                              <ProgressBar pct={checklistPct} className="flex-1 sm:hidden" />
                            </>
                          )}
                        </div>
                        {checklist.length > 0 && <ProgressBar pct={checklistPct} className="hidden sm:block" />}

                        {checklist.length > 0 && (
                          <div className="flex flex-col">
                            {checklist.map((item, idx) => (
                              <div key={idx} className="tdd-row flex items-center gap-1">
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={item.done}
                                  disabled={!canWork}
                                  className="cal-focus flex flex-1 min-w-0 items-center gap-3 text-left min-h-11 sm:min-h-10 px-1 sm:px-2"
                                  style={{ border: "none", background: "transparent", borderRadius: 10, color: "var(--cal-ink)", cursor: canWork ? "pointer" : "default" }}
                                  onClick={() => handleChecklistToggle(idx)}
                                >
                                  <span className="tdd-box grid place-items-center h-6 w-6 sm:h-[22px] sm:w-[22px]" data-on={item.done ? "" : undefined}>
                                    {item.done && <Check className="h-[13px] w-[13px]" strokeWidth={3.4} color="#ffffff" />}
                                  </span>
                                  <span
                                    className="text-[15px] sm:text-sm"
                                    style={{ flex: 1, minWidth: 0, lineHeight: 1.35, overflowWrap: "anywhere", color: item.done ? "var(--cal-muted)" : "var(--cal-ink)", textDecoration: item.done ? "line-through" : undefined }}
                                  >
                                    {item.label}
                                  </span>
                                </button>
                                {canEdit && (
                                  <button type="button" aria-label={`Delete "${item.label}"`} className="tdd-del cal-focus grid place-items-center mr-1" onClick={() => handleChecklistDelete(idx)}>
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {canEdit && (addingItem ? (
                          <div className="flex items-center gap-2">
                            <input
                              ref={newItemInputRef}
                              className="cal-field flex-1 min-w-0"
                              style={{ fontSize: 14, borderRadius: 12, background: "var(--cal-surface)" }}
                              aria-label="New checklist item"
                              placeholder="Add an item…"
                              value={newChecklistItem}
                              onChange={(e) => setNewChecklistItem(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddChecklistItem(); if (e.key === "Escape") cancelAddItem(); }}
                              autoFocus
                            />
                            <button type="button" className="tdd-primary cal-focus" style={{ height: 40, padding: "0 14px", borderRadius: 12, fontSize: 13 }} onClick={handleAddChecklistItem}>Add</button>
                            <button type="button" className="tdd-ghost cal-focus" style={{ height: 40, padding: "0 10px", borderRadius: 12, fontSize: 13, color: "var(--cal-ink-2)" }} onClick={cancelAddItem}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="tdd-ghost cal-focus inline-flex items-center gap-2 self-start"
                            style={{ height: 40, padding: "0 10px", borderRadius: 10, color: "var(--cal-ink-2)", fontSize: 14 }}
                            onClick={() => setAddingItem(true)}
                          >
                            <Plus className="h-4 w-4" strokeWidth={2.2} /> Add an item
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Description */}
                <div className="order-4 sm:order-2 flex flex-col gap-2">
                  <label htmlFor={`${uid}-desc`} className="tdd-lbl">Description</label>
                  <textarea
                    id={`${uid}-desc`}
                    className="tdd-area"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    rows={3}
                    disabled={!canEdit}
                    placeholder="Add a description…"
                  />
                </div>

                {/* Phones: the rest of the fields, further down the sheet */}
                <div className="order-5 sm:hidden flex flex-col gap-3.5">
                  <Field label="Category" htmlFor={`${uid}-cat-m`}>{categorySelect(`${uid}-cat-m`)}</Field>
                  {userRole === "WC" && <Field label="Move to watch" htmlFor={`${uid}-watch-m`}>{watchSelect(`${uid}-watch-m`)}</Field>}
                  {canEdit && (
                    <Field label="Cover" htmlFor={`${uid}-cover-m`}>
                      <button
                        id={`${uid}-cover-m`}
                        type="button"
                        className="tdd-field cal-focus flex items-center"
                        aria-haspopup="dialog"
                        aria-expanded={showCoverPicker}
                        onClick={() => setShowCoverPicker(!showCoverPicker)}
                      >
                        <span aria-hidden="true" style={{ width: 28, height: 18, borderRadius: 5, flex: "none", ...(coverStyle ?? { border: "1.5px dashed var(--cal-line-2)" }) }} />
                        {coverStyle ? "Change cover" : "Add cover"}
                        <ChevronDown className="ml-auto" style={{ transform: showCoverPicker ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
                      </button>
                    </Field>
                  )}
                </div>

                {/* Cover picker — a popover under the Cover button on desktop, inline on phones */}
                {showCoverPicker && canEdit && (
                  <section
                    ref={pickerRef}
                    role="dialog"
                    aria-label="Cover"
                    className="tdd-pop order-6 flex flex-col gap-3 sm:absolute sm:right-16 sm:top-[58px] sm:w-[340px] sm:z-[5]"
                    style={{ background: "var(--cal-surface)", border: "1px solid var(--cal-line)", borderRadius: 20, padding: 16, color: "var(--cal-ink)" }}
                    onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setShowCoverPicker(false); } }}
                  >
                    <div className="flex items-center justify-between" style={{ minHeight: 28 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>Cover</span>
                      {coverColour && (
                        <button
                          type="button"
                          className="tdd-danger cal-focus"
                          style={{ fontSize: 13, fontWeight: 600, padding: "4px 8px", margin: "-4px -8px", borderRadius: 8 }}
                          onClick={() => handleCoverChange("")}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div role="tablist" aria-label="Cover source" className="tdd-seg" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                      {COVER_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          id={`${uid}-tab-${tab.id}`}
                          aria-selected={coverTab === tab.id}
                          aria-controls={`${uid}-panel-${tab.id}`}
                          className="tdd-seg-btn cal-focus"
                          style={{ height: 32 }}
                          onClick={() => setCoverTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div role="tabpanel" id={`${uid}-panel-${coverTab}`} aria-labelledby={`${uid}-tab-${coverTab}`} className="flex flex-col gap-3">
                      {/* ── Colours ── */}
                      {coverTab === "colours" && (
                        <>
                          <div className="grid grid-cols-4 gap-2">
                            {CARD_COVERS.filter((c) => c.id).map((c) => {
                              const on = coverColour === c.id;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  aria-label={c.name}
                                  aria-pressed={on}
                                  title={c.name}
                                  className="tdd-swatch cal-focus"
                                  style={{ height: 40, borderRadius: 10, border: "none", padding: 0, background: c.bg, boxShadow: on ? "0 0 0 2px var(--cal-surface), 0 0 0 4px var(--cal-brand)" : undefined }}
                                  onClick={() => handleCoverChange(c.id)}
                                />
                              );
                            })}
                          </div>
                          <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--cal-muted)" }}>
                            Upload: images are cropped to <span className="cal-mono">800 × 300</span>. Unsplash: search, then pick a photo.
                          </span>
                        </>
                      )}

                      {/* ── Upload ── */}
                      {coverTab === "upload" && (
                        <>
                          <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--cal-muted)" }}>
                            Upload an image — it will be cropped to <span className="cal-mono">800 × 300</span> px (Trello size).
                          </span>
                          <button
                            type="button"
                            className="tdd-drop cal-focus flex flex-col items-center justify-center gap-2"
                            style={{ padding: "22px 12px", borderRadius: 14, fontSize: 13, fontWeight: 600 }}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-5 w-5" />
                            Choose an image
                          </button>
                          {coverColour.startsWith("data:") && (
                            <div className="relative overflow-hidden" style={{ height: 80, borderRadius: 12 }}>
                              <img src={coverColour} alt="Current cover" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                aria-label="Remove uploaded cover"
                                className="cal-focus absolute grid place-items-center"
                                style={{ top: 6, right: 6, width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(0,0,0,.55)", color: "#ffffff", cursor: "pointer" }}
                                onClick={() => handleCoverChange("")}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {/* ── Unsplash ── */}
                      {coverTab === "unsplash" && (
                        !unsplashKey || showKeyInput ? (
                          <>
                            <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--cal-muted)" }}>
                              Get a free API key at{" "}
                              <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" style={{ color: "var(--cal-brand-text)", textDecoration: "underline" }}>unsplash.com/developers</a>
                              {" "}→ New Application → copy the <strong style={{ color: "var(--cal-ink-2)" }}>Access Key</strong>.
                            </span>
                            <div className="flex gap-2">
                              <input
                                className="cal-field cal-mono flex-1 min-w-0"
                                style={{ fontSize: 12 }}
                                aria-label="Unsplash access key"
                                placeholder="Paste your Unsplash Access Key…"
                                value={keyDraft}
                                onChange={(e) => setKeyDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveUnsplashKey(); }}
                                autoFocus
                              />
                              <button type="button" className="tdd-primary cal-focus" style={{ height: 40, padding: "0 14px", borderRadius: 10, fontSize: 13 }} onClick={handleSaveUnsplashKey} disabled={!keyDraft.trim()}>
                                Save
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--cal-muted)" }} />
                                <input
                                  className="cal-field w-full"
                                  style={{ paddingLeft: 30 }}
                                  aria-label="Search Unsplash"
                                  placeholder="Search Unsplash…"
                                  value={unsplashQuery}
                                  onChange={(e) => setUnsplashQuery(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleUnsplashSearch(); }}
                                  autoFocus
                                />
                              </div>
                              <button
                                type="button"
                                className="tdd-primary cal-focus"
                                style={{ height: 40, padding: "0 12px", borderRadius: 10, fontSize: 13 }}
                                onClick={() => handleUnsplashSearch()}
                                disabled={unsplashLoading || !unsplashQuery.trim()}
                              >
                                {unsplashLoading ? "…" : "Search"}
                              </button>
                              <button
                                type="button"
                                aria-label="Change API key"
                                title="Change API key"
                                className="tdd-soft cal-focus grid place-items-center flex-none"
                                style={{ width: 40, height: 40, borderRadius: 10 }}
                                onClick={() => { setShowKeyInput(true); setKeyDraft(unsplashKey); }}
                              >
                                <Key className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {unsplashResults.length === 0 && !unsplashLoading && (
                              <div className="flex flex-wrap gap-1.5">
                                {["fire station", "firefighter", "emergency", "training", "safety"].map((term) => (
                                  <button key={term} type="button" className="tdd-pill cal-focus" onClick={() => { setUnsplashQuery(term); handleUnsplashSearch(term); }}>
                                    {term}
                                  </button>
                                ))}
                              </div>
                            )}

                            {unsplashResults.length > 0 && (
                              <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                                {unsplashResults.map((photo) => {
                                  const on = coverColour === photo.full;
                                  return (
                                    <button
                                      key={photo.id}
                                      type="button"
                                      aria-label={photo.alt}
                                      aria-pressed={on}
                                      title={photo.alt}
                                      className="tdd-swatch cal-focus relative overflow-hidden"
                                      style={{ height: 64, borderRadius: 10, border: "none", padding: 0, background: "var(--cal-surface-3)", boxShadow: on ? "0 0 0 2px var(--cal-surface), 0 0 0 4px var(--cal-brand)" : undefined }}
                                      onClick={() => handleCoverChange(photo.full)}
                                    >
                                      <img src={photo.thumb} alt="" className="h-full w-full object-cover" />
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <span style={{ fontSize: 10, color: "var(--cal-muted)", textAlign: "right" }}>
                              Photos from <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Unsplash</a>
                            </span>
                          </>
                        )
                      )}
                    </div>
                  </section>
                )}

                {/* Phones: delete at the bottom of the sheet */}
                {canEdit && (
                  <button
                    type="button"
                    className="order-7 sm:hidden tdd-danger cal-focus flex items-center justify-center gap-2"
                    style={{ height: 48, borderRadius: 14, border: "1px solid var(--cal-line-2)", fontSize: 15, fontWeight: 600 }}
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" /> Delete task
                  </button>
                )}

                {/* Meta */}
                <div className="order-8 sm:order-4 flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontSize: 12, color: "var(--cal-muted)", paddingTop: 8, borderTop: "1px solid var(--cal-line)" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-[13px] w-[13px]" />
                    Created <span className="cal-mono">{new Date(task.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </span>
                  {task.assigned_to_user_id && (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-[13px] w-[13px]" /> Assigned
                    </span>
                  )}
                </div>
              </div>

              {/* ── Right rail (desktop) ─────────────────────────────────── */}
              <div className="hidden sm:flex flex-col gap-3.5 min-w-0">
                <Field label="Column" htmlFor={`${uid}-col`}>
                  <Select value={status} onValueChange={handleStatusChange} disabled={!canWork}>
                    <SelectTrigger id={`${uid}-col`} className="tdd-field cal-focus">
                      <SelectValue>
                        {statusCol ? <span className="flex items-center gap-2"><Dot color={statusCol.color} />{statusCol.name}</span> : status}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="cal-menu">{columnItems}</SelectContent>
                  </Select>
                </Field>

                <Field label="Category" htmlFor={`${uid}-cat`}>{categorySelect(`${uid}-cat`)}</Field>

                <Field label="Due date" htmlFor={`${uid}-due`} hint={dueHint}>
                  <input
                    id={`${uid}-due`}
                    type="date"
                    className="cal-field tdd-field cal-mono cal-focus"
                    style={dueBorder}
                    value={dueDate}
                    onChange={handleDueChange}
                    disabled={!canEdit}
                  />
                </Field>

                {showCustomRrule && canEdit
                  ? customPanel(
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`${uid}-rec`} className="tdd-lbl">Recurrence</label>
                        {recurrenceSelect(`${uid}-rec`, "compact")}
                      </div>
                    )
                  : <Field label="Recurrence" htmlFor={`${uid}-rec`}>{recurrenceSelect(`${uid}-rec`, "field")}</Field>}

                {/* Move to Watch (WC only) */}
                {userRole === "WC" && <Field label="Move to watch" htmlFor={`${uid}-watch`}>{watchSelect(`${uid}-watch`)}</Field>}

                <div className="flex flex-col gap-1.5">
                  <span id={`${uid}-pri`} className="tdd-lbl">Priority</span>
                  <div role="radiogroup" aria-labelledby={`${uid}-pri`} className="tdd-seg" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }} onKeyDown={onPriorityKeyDown}>
                    {PRIORITY_OPTIONS.map((p) => {
                      const on = priority === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          tabIndex={on ? 0 : -1}
                          disabled={!canEdit}
                          className="tdd-seg-btn cal-focus"
                          onClick={() => handlePriorityChange(p.value)}
                        >
                          <Dot color={`var(--cal-${priorityKey(p.value)}-dot)`} size={7} />
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Danger zone */}
                {canEdit && (
                  <button
                    type="button"
                    className="tdd-danger cal-focus inline-flex items-center gap-1.5 self-start"
                    style={{ height: 40, padding: "0 8px", marginLeft: -8, marginTop: 4, borderRadius: 10, fontSize: 14, fontWeight: 600 }}
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-[15px] w-[15px]" /> Delete task
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
