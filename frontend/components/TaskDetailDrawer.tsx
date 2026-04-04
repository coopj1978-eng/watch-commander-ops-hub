import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { useUserRole } from "@/lib/rbac";
import { getNextShiftDate } from "@/lib/shiftRota";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import {
  X, Trash2, Calendar, Flag, Tag, User, Repeat, Plus, CheckSquare,
  AlignLeft, GripVertical, Clock, ImageIcon, Search, Upload, Key, ArrowRightLeft,
} from "lucide-react";
import { TASK_LABELS, CARD_COVERS, getCoverStyle } from "@/lib/taskLabels";
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

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "High", label: "High",   color: "text-red-500" },
  { value: "Med",  label: "Medium", color: "text-orange-500" },
  { value: "Low",  label: "Low",    color: "text-blue-500" },
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
  { label: "Mon–Fri",         value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Weekly",          value: "FREQ=WEEKLY;INTERVAL=1" },
  { label: "Fortnightly",     value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Monthly",         value: "FREQ=MONTHLY;INTERVAL=1" },
  { label: "Custom…",         value: "__custom__" },
];

function parseRRuleLabel(rrule?: string): string {
  if (!rrule || rrule === "__none__") return "None";
  const p = RRULE_PRESETS.find((p) => p.value === rrule && p.value !== "__custom__" && p.value !== "__none__");
  return p ? p.label : "Custom";
}

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

const WATCHES = ["Amber", "Green", "Blue", "Red", "White"];

export default function TaskDetailDrawer({ task, columns, onClose, onDelete, canEdit = false, isNewTask = false, onCompleted }: TaskDetailDrawerProps) {
  const { user } = useAuth();
  const userRole = useUserRole();
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

  useEffect(() => {
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
  }, [task?.id]);

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => backend.task.update(task!.id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast({ title: "Error", description: "Failed to save", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => backend.task.deleteTask(task!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onDelete?.(task!.id);
      onClose();
      toast({ title: "Task deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete task", variant: "destructive" }),
  });

  if (!task) return null;

  const save = async (updates: any) => {
    setSaving(true);
    try { await updateMutation.mutateAsync(updates); }
    finally { setSaving(false); }
  };

  const handleTitleBlur = () => { if (title.trim() && title !== task.title) save({ title: title.trim() }); };
  const handleDescriptionBlur = () => { if (description !== (task.description ?? "")) save({ description }); };

  const handleStatusChange = (val: string) => {
    const isDone = (k: string) => k === "Done" || columns.find(c => c.status_key === k)?.name.toLowerCase().includes("done") || columns.find(c => c.status_key === k)?.name.toLowerCase().includes("complete");
    const wasDone = isDone(task.status);
    const nowDone = isDone(val);
    setStatus(val);
    save({ status: val });
    if (!wasDone && nowDone) onCompleted?.(task);
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

  const handleUnsplashSearch = async () => {
    if (!unsplashKey || !unsplashQuery.trim()) return;
    setUnsplashLoading(true);
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(unsplashQuery)}&per_page=12&orientation=landscape&client_id=${unsplashKey}`
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

  const handleDelete = () => {
    if (confirm(`Delete "${task.title}"? This cannot be undone.`)) deleteMutation.mutate();
  };

  const completedCount = checklist.filter((i) => i.done).length;
  const checklistPct = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  const dueDateObj = dueDate ? new Date(dueDate + "T12:00:00") : null;
  const diffDays = dueDateObj ? Math.ceil((dueDateObj.getTime() - Date.now()) / 86400000) : null;
  const isOverdue = diffDays !== null && diffDays < 0 && status !== "Done";
  const isDueToday = diffDays === 0;

  const currentRruleVal = showCustomRrule ? "__custom__" : (rrule || "__none__");
  const coverStyle = getCoverStyle(coverColour);
  const statusCol = columns.find((c) => c.status_key === status);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Centered modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
        <div className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden">

          {/* ── Cover area ──────────────────────────────────────────────── */}
          {coverStyle ? (
            <div className="relative w-full h-32 rounded-t-2xl" style={coverStyle}>
              {canEdit && (
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <button
                    onClick={() => setShowCoverPicker(!showCoverPicker)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-white text-xs font-medium transition-colors"
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> Change Cover
                  </button>
                  <button
                    onClick={() => handleCoverChange("")}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-white text-xs font-medium transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {/* ── Modal header ─────────────────────────────────────────────── */}
          <div className={`flex items-start justify-between px-6 pt-5 pb-0 ${!coverStyle ? "pt-5" : "pt-4"}`}>
            <div className="flex-1 min-w-0">
              {/* Status badge */}
              {statusCol && (
                <Badge variant="outline" className="mb-2 text-xs" style={{ borderColor: statusCol.color, color: statusCol.color }}>
                  {statusCol.name}
                </Badge>
              )}
              {/* Title */}
              <textarea
                className="w-full text-xl font-bold bg-transparent border-none outline-none resize-none text-foreground leading-snug focus:ring-2 focus:ring-indigo-400/50 rounded-lg px-0"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                rows={2}
                disabled={!canEdit}
                placeholder="Task title"
              />
            </div>
            <div className="flex items-center gap-1 ml-4 shrink-0">
              {saving && <span className="text-xs text-muted-foreground mr-1">Saving…</span>}
              {canEdit && !coverStyle && (
                <div className="relative">
                  <button
                    onClick={() => setShowCoverPicker(!showCoverPicker)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Add cover"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
              {canEdit && (
                <button onClick={handleDelete} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete task">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Cover picker ─────────────────────────────────────────────── */}
          {showCoverPicker && canEdit && (
            <div className="mx-6 mt-3 rounded-xl border border-border bg-background shadow-lg overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-border">
                {(["colours", "upload", "unsplash"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCoverTab(tab)}
                    className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${coverTab === tab ? "text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {tab === "colours" ? "🎨 Colours" : tab === "upload" ? "⬆ Upload" : "📷 Unsplash"}
                  </button>
                ))}
              </div>

              <div className="p-3">
                {/* ── Colours tab ── */}
                {coverTab === "colours" && (
                  <div className="grid grid-cols-9 gap-1.5">
                    {CARD_COVERS.map((c) => (
                      <button
                        key={c.id || "none"}
                        onClick={() => handleCoverChange(c.id)}
                        title={c.name}
                        className={`h-8 rounded-lg border-2 transition-all hover:scale-110 ${coverColour === c.id ? "border-indigo-500 scale-110 shadow" : "border-transparent"}`}
                        style={c.id ? { background: c.bg } : { background: "#f1f5f9", border: "2px dashed #cbd5e1" }}
                      >
                        {!c.id && <span className="text-xs text-slate-400">✕</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Upload tab ── */}
                {coverTab === "upload" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Upload an image — it will be cropped to 800 × 300 px (Trello size).</p>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
                    >
                      <Upload className="h-5 w-5" />
                      Click to choose an image
                    </button>
                    {coverColour.startsWith("data:") && (
                      <div className="relative rounded-xl overflow-hidden h-20">
                        <img src={coverColour} alt="Current cover" className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleCoverChange("")}
                          className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Unsplash tab ── */}
                {coverTab === "unsplash" && (
                  <div className="space-y-3">
                    {/* API key setup */}
                    {!unsplashKey || showKeyInput ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Get a free API key at{" "}
                          <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline">unsplash.com/developers</a>
                          {" "}→ New Application → copy the <strong>Access Key</strong>.
                        </p>
                        <div className="flex gap-2">
                          <input
                            className="flex-1 h-8 rounded-lg border border-border px-2 text-xs bg-background outline-none focus:border-indigo-400 font-mono"
                            placeholder="Paste your Unsplash Access Key…"
                            value={keyDraft}
                            onChange={(e) => setKeyDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveUnsplashKey(); }}
                            autoFocus
                          />
                          <button
                            onClick={handleSaveUnsplashKey}
                            disabled={!keyDraft.trim()}
                            className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Search bar */}
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              className="w-full h-8 pl-7 pr-3 rounded-lg border border-border text-xs bg-background outline-none focus:border-indigo-400"
                              placeholder="Search Unsplash…"
                              value={unsplashQuery}
                              onChange={(e) => setUnsplashQuery(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleUnsplashSearch(); }}
                              autoFocus
                            />
                          </div>
                          <button
                            onClick={handleUnsplashSearch}
                            disabled={unsplashLoading || !unsplashQuery.trim()}
                            className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                          >
                            {unsplashLoading ? "…" : "Search"}
                          </button>
                          <button
                            onClick={() => { setShowKeyInput(true); setKeyDraft(unsplashKey); }}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-indigo-400 transition-colors"
                            title="Change API key"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Default suggestions */}
                        {unsplashResults.length === 0 && !unsplashLoading && (
                          <div className="flex flex-wrap gap-1.5">
                            {["fire station","firefighter","emergency","training","safety"].map((term) => (
                              <button
                                key={term}
                                onClick={() => { setUnsplashQuery(term); setTimeout(handleUnsplashSearch, 50); }}
                                className="px-2.5 py-1 rounded-full text-xs bg-muted/60 text-muted-foreground hover:bg-indigo-100 hover:text-indigo-700 transition-colors border border-border"
                              >
                                {term}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Photo grid */}
                        {unsplashResults.length > 0 && (
                          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                            {unsplashResults.map((photo) => (
                              <button
                                key={photo.id}
                                onClick={() => handleCoverChange(photo.full)}
                                className={`relative h-16 rounded-lg overflow-hidden hover:scale-105 transition-all border-2 ${coverColour === photo.full ? "border-indigo-500 scale-105" : "border-transparent"}`}
                                title={photo.alt}
                              >
                                <img src={photo.thumb} alt={photo.alt} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}

                        <p className="text-[10px] text-muted-foreground/60 text-right">
                          Photos from <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">Unsplash</a>
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Two-column body ──────────────────────────────────────────── */}
          <div className="flex gap-0 px-6 pb-6 pt-4 overflow-y-auto max-h-[70vh]">

            {/* Left: main content */}
            <div className="flex-1 min-w-0 space-y-5 pr-6">

              {/* Labels */}
              {(canEdit || tags.length > 0) && (
                <div>
                  <SectionLabel icon={Tag}>Labels</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {TASK_LABELS.map((label) => {
                      const active = tags.includes(label.id);
                      return (
                        <button
                          key={label.id}
                          onClick={() => canEdit && handleTagToggle(label.id)}
                          disabled={!canEdit}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                            active ? "text-white border-transparent shadow-sm" : "bg-muted/50 text-muted-foreground border-border"
                          } ${canEdit ? "hover:scale-105 cursor-pointer" : "cursor-default"}`}
                          style={active ? { backgroundColor: label.colour } : {}}
                          onMouseEnter={(e) => { if (canEdit && !active) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = label.colour; (e.currentTarget as HTMLButtonElement).style.color = "white"; } }}
                          onMouseLeave={(e) => { if (canEdit && !active) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""; (e.currentTarget as HTMLButtonElement).style.color = ""; } }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? "rgba(255,255,255,0.7)" : label.colour }} />
                          {label.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <SectionLabel icon={AlignLeft}>Description</SectionLabel>
                <textarea
                  className="w-full text-sm bg-muted/40 rounded-xl p-3 border border-transparent focus:border-indigo-400 outline-none resize-none text-foreground placeholder:text-muted-foreground"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  rows={3}
                  disabled={!canEdit}
                  placeholder="Add a description…"
                />
              </div>

              {/* Checklist */}
              <div>
                <SectionLabel icon={CheckSquare}>
                  Checklist
                  {checklist.length > 0 && <span className="ml-1 normal-case font-normal">{completedCount}/{checklist.length}</span>}
                </SectionLabel>

                {checklist.length > 0 && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${checklistPct}%` }}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  {checklist.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 group py-1 px-2 rounded-lg hover:bg-muted/40 transition-colors">
                      <Checkbox
                        checked={item.done}
                        onCheckedChange={() => canEdit && handleChecklistToggle(idx)}
                        className="mt-0.5"
                        id={`modal-check-${task.id}-${idx}`}
                      />
                      <label
                        htmlFor={`modal-check-${task.id}-${idx}`}
                        className={`flex-1 text-sm cursor-pointer leading-snug select-none ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}
                      >
                        {item.label}
                      </label>
                      {canEdit && (
                        <button onClick={() => handleChecklistDelete(idx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {canEdit && (
                  addingItem ? (
                    <div className="flex gap-2 mt-2">
                      <input
                        ref={newItemInputRef}
                        className="flex-1 h-8 rounded-xl border border-border px-3 text-sm bg-background outline-none focus:border-indigo-400"
                        placeholder="Add an item…"
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddChecklistItem(); if (e.key === "Escape") { setAddingItem(false); setNewChecklistItem(""); } }}
                        autoFocus
                      />
                      <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-xs rounded-xl" onClick={handleAddChecklistItem}>Add</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs rounded-xl" onClick={() => { setAddingItem(false); setNewChecklistItem(""); }}>Cancel</Button>
                    </div>
                  ) : (
                    <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-2 py-1 px-2 rounded-lg hover:bg-muted/40 transition-colors w-full" onClick={() => setAddingItem(true)}>
                      <Plus className="h-3.5 w-3.5" /> Add an item
                    </button>
                  )
                )}
              </div>

              {/* Meta */}
              <div className="text-xs text-muted-foreground flex items-center gap-4 pt-2 border-t border-border">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Created {new Date(task.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                {task.assigned_to_user_id && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" /> Assigned
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="w-44 shrink-0 space-y-4">

              {/* Column */}
              <div>
                <SectionLabel icon={GripVertical}>Column</SectionLabel>
                <Select value={status} onValueChange={handleStatusChange} disabled={!canEdit}>
                  <SelectTrigger className="h-8 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.status_key}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: col.color }} />
                          {col.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div>
                <SectionLabel icon={Flag}>Priority</SectionLabel>
                <Select value={priority} onValueChange={(v) => { setPriority(v as TaskPriority); save({ priority: v }); }} disabled={!canEdit}>
                  <SelectTrigger className="h-8 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className={p.color}>{p.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div>
                <SectionLabel icon={Tag}>Category</SectionLabel>
                <Select value={category} onValueChange={(v) => { setCategory(v as TaskCategory); save({ category: v }); }} disabled={!canEdit}>
                  <SelectTrigger className="h-8 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div>
                <SectionLabel icon={Calendar}>
                  Due Date
                  {isOverdue && <span className="text-red-500 normal-case font-normal ml-1">(overdue)</span>}
                  {isDueToday && <span className="text-orange-500 normal-case font-normal ml-1">(today)</span>}
                </SectionLabel>
                <input
                  type="date"
                  className={`h-8 w-full rounded-xl border px-2 text-xs bg-background outline-none focus:border-indigo-400 ${isOverdue ? "border-red-400 text-red-500" : isDueToday ? "border-orange-400" : "border-input"}`}
                  value={dueDate}
                  onChange={(e) => { setDueDate(e.target.value); save({ due_date: e.target.value ? new Date(e.target.value) : undefined }); }}
                  disabled={!canEdit}
                />
              </div>

              {/* Recurrence */}
              <div>
                <SectionLabel icon={Repeat}>Recurrence</SectionLabel>
                <Select value={currentRruleVal} onValueChange={(val) => {
                  if (val === "__custom__") { setShowCustomRrule(true); setRrule("__custom__"); return; }
                  setShowCustomRrule(false); setRrule(val);
                  save({ rrule: val === "__none__" ? undefined : val });
                }} disabled={!canEdit}>
                  <SelectTrigger className="h-8 text-xs rounded-xl">
                    <SelectValue>{parseRRuleLabel(showCustomRrule ? customRrule : rrule)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {RRULE_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {showCustomRrule && canEdit && (
                  <div className="flex gap-1 mt-1">
                    <input
                      className="flex-1 h-7 rounded-lg border border-input px-2 text-xs bg-background outline-none focus:border-indigo-400"
                      placeholder="FREQ=WEEKLY;BYDAY=TU"
                      value={customRrule}
                      onChange={(e) => setCustomRrule(e.target.value)}
                    />
                    <Button size="sm" className="h-7 text-xs px-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg" onClick={() => save({ rrule: customRrule || undefined })}>
                      Save
                    </Button>
                  </div>
                )}
              </div>

              {/* Move to Watch (WC only) */}
              {userRole === "WC" && (
                <div>
                  <SectionLabel icon={ArrowRightLeft}>Move to Watch</SectionLabel>
                  <Select value={watchUnit || "__none__"} onValueChange={(v) => {
                    const val = v === "__none__" ? "" : v;
                    setWatchUnit(val);
                    save({ watch_unit: val || null });
                    toast({ title: "Task moved", description: val ? `Moved to ${val} Watch` : "Watch cleared" });
                  }}>
                    <SelectTrigger className="h-8 text-xs rounded-xl">
                      <SelectValue placeholder="Assign watch…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {WATCHES.map((w) => (
                        <SelectItem key={w} value={w}>{w} Watch</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Danger zone */}
              {canEdit && (
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete task
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
