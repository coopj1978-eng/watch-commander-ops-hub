import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import {
  X, Trash2, Calendar, Flag, Tag, User, Repeat, Plus, CheckSquare,
  AlignLeft, GripVertical, Clock,
} from "lucide-react";
import type { Task, TaskColumn, ChecklistItem, TaskCategory, TaskPriority } from "~backend/task/types";

interface TaskDetailDrawerProps {
  task: Task | null;
  columns: TaskColumn[];
  onClose: () => void;
  onDelete?: (taskId: number) => void;
  canEdit?: boolean;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "High", label: "High", color: "text-red-500" },
  { value: "Med", label: "Medium", color: "text-orange-500" },
  { value: "Low", label: "Low", color: "text-blue-500" },
];

const CATEGORY_OPTIONS: TaskCategory[] = ["Training", "Inspection", "HFSV", "Admin", "Other"];

const RRULE_PRESETS = [
  { label: "None", value: "__none__" },
  { label: "Daily", value: "FREQ=DAILY;INTERVAL=1" },
  { label: "Every Monday", value: "FREQ=WEEKLY;BYDAY=MO" },
  { label: "Every Tuesday", value: "FREQ=WEEKLY;BYDAY=TU" },
  { label: "Every Wednesday", value: "FREQ=WEEKLY;BYDAY=WE" },
  { label: "Every Thursday", value: "FREQ=WEEKLY;BYDAY=TH" },
  { label: "Every Friday", value: "FREQ=WEEKLY;BYDAY=FR" },
  { label: "Mon–Fri (weekdays)", value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Weekly", value: "FREQ=WEEKLY;INTERVAL=1" },
  { label: "Fortnightly", value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Monthly", value: "FREQ=MONTHLY;INTERVAL=1" },
  { label: "Custom…", value: "__custom__" },
];

function parseRRuleLabel(rrule?: string): string {
  if (!rrule || rrule === "__none__") return "None";
  const preset = RRULE_PRESETS.find((p) => p.value === rrule && p.value !== "__custom__" && p.value !== "__none__");
  if (preset) return preset.label;
  return "Custom";
}

export default function TaskDetailDrawer({ task, columns, onClose, onDelete, canEdit = false }: TaskDetailDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local editable state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Med");
  const [category, setCategory] = useState<TaskCategory>("Other");
  const [dueDate, setDueDate] = useState("");
  const [rrule, setRrule] = useState("");
  const [customRrule, setCustomRrule] = useState("");
  const [showCustomRrule, setShowCustomRrule] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [saving, setSaving] = useState(false);

  const newItemInputRef = useRef<HTMLInputElement>(null);

  // Sync state when task changes
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setCategory(task.category);
    setDueDate(task.due_at ? new Date(task.due_at).toISOString().split("T")[0] : "");
    setRrule(task.rrule ?? "__none__");
    setCustomRrule(task.rrule ?? "");
    setShowCustomRrule(
      !!task.rrule && !RRULE_PRESETS.some((p) => p.value === task.rrule && p.value !== "__custom__" && p.value !== "__none__")
    );
    setChecklist(task.checklist ? [...task.checklist] : []);
    setAddingItem(false);
    setNewChecklistItem("");
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
    try {
      await updateMutation.mutateAsync(updates);
    } finally {
      setSaving(false);
    }
  };

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) save({ title: title.trim() });
  };

  const handleDescriptionBlur = () => {
    if (description !== (task.description ?? "")) save({ description });
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    save({ status: val });
  };

  const handlePriorityChange = (val: TaskPriority) => {
    setPriority(val);
    save({ priority: val });
  };

  const handleCategoryChange = (val: TaskCategory) => {
    setCategory(val);
    save({ category: val });
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDueDate(e.target.value);
    save({ due_date: e.target.value ? new Date(e.target.value) : undefined });
  };

  const handleRruleChange = (val: string) => {
    if (val === "__custom__") {
      setShowCustomRrule(true);
      setRrule("__custom__");
      return;
    }
    setShowCustomRrule(false);
    setRrule(val);
    save({ rrule: val === "__none__" ? undefined : val });
  };

  const handleCustomRruleSave = () => {
    save({ rrule: customRrule || undefined });
  };

  const handleChecklistToggle = (idx: number) => {
    const updated = checklist.map((item, i) => (i === idx ? { ...item, done: !item.done } : item));
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
    if (confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const completedCount = checklist.filter((i) => i.done).length;
  const checklistPct = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  const dueDateObj = dueDate ? new Date(dueDate + "T12:00:00") : null;
  const now = new Date();
  const diffDays = dueDateObj ? Math.ceil((dueDateObj.getTime() - now.getTime()) / 86400000) : null;
  const isOverdue = diffDays !== null && diffDays < 0 && status !== "Done";
  const isDueToday = diffDays === 0;

  const currentRruleVal = showCustomRrule ? "__custom__" : (rrule || "__none__");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              style={{ borderColor: columns.find((c) => c.status_key === status)?.color, color: columns.find((c) => c.status_key === status)?.color }}
              className="text-xs"
            >
              {columns.find((c) => c.status_key === status)?.name ?? status}
            </Badge>
            {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
          </div>
          <div className="flex items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                onClick={handleDelete}
                title="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Title */}
          <div>
            <textarea
              className="w-full text-xl font-semibold bg-transparent border-none outline-none resize-none text-foreground leading-snug focus:ring-1 focus:ring-red-500 rounded px-1 -mx-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              rows={2}
              disabled={!canEdit}
              placeholder="Task title"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <AlignLeft className="h-3.5 w-3.5" />
              Description
            </div>
            <textarea
              className="w-full text-sm bg-muted/40 rounded-md p-2.5 border border-transparent focus:border-red-500 outline-none resize-none text-foreground placeholder:text-muted-foreground"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              rows={3}
              disabled={!canEdit}
              placeholder="Add a description…"
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <GripVertical className="h-3.5 w-3.5" />
                Column
              </div>
              <Select value={status} onValueChange={handleStatusChange} disabled={!canEdit}>
                <SelectTrigger className="h-8 text-sm">
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

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Flag className="h-3.5 w-3.5" />
                Priority
              </div>
              <Select value={priority} onValueChange={(v) => handlePriorityChange(v as TaskPriority)} disabled={!canEdit}>
                <SelectTrigger className="h-8 text-sm">
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
          </div>

          {/* Category + Due Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Tag className="h-3.5 w-3.5" />
                Category
              </div>
              <Select value={category} onValueChange={(v) => handleCategoryChange(v as TaskCategory)} disabled={!canEdit}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" />
                Due Date
                {isOverdue && <span className="text-red-500 normal-case font-normal">(overdue)</span>}
                {isDueToday && <span className="text-orange-500 normal-case font-normal">(today)</span>}
              </div>
              <input
                type="date"
                className={`h-8 w-full rounded-md border px-2 text-sm bg-background outline-none focus:border-red-500 ${
                  isOverdue ? "border-red-400 text-red-500" : isDueToday ? "border-orange-400" : "border-input"
                }`}
                value={dueDate}
                onChange={handleDueDateChange}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Repeat className="h-3.5 w-3.5" />
              Recurrence
            </div>
            <Select value={currentRruleVal} onValueChange={handleRruleChange} disabled={!canEdit}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="None">
                  {parseRRuleLabel(showCustomRrule ? customRrule : rrule)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {RRULE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showCustomRrule && canEdit && (
              <div className="flex gap-2 mt-1">
                <input
                  className="flex-1 h-8 rounded-md border border-input px-2 text-xs bg-background outline-none focus:border-red-500"
                  placeholder="e.g. FREQ=WEEKLY;BYDAY=TU,TH"
                  value={customRrule}
                  onChange={(e) => setCustomRrule(e.target.value)}
                />
                <Button size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700" onClick={handleCustomRruleSave}>
                  Save
                </Button>
              </div>
            )}
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <CheckSquare className="h-3.5 w-3.5" />
                Checklist
                {checklist.length > 0 && (
                  <span className="ml-1 normal-case font-normal">
                    {completedCount}/{checklist.length}
                  </span>
                )}
              </div>
            </div>

            {checklist.length > 0 && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${checklistPct}%` }}
                />
              </div>
            )}

            <div className="space-y-1">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 group py-0.5">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={() => canEdit && handleChecklistToggle(idx)}
                    className="mt-0.5"
                    id={`drawer-check-${task.id}-${idx}`}
                  />
                  <label
                    htmlFor={`drawer-check-${task.id}-${idx}`}
                    className={`flex-1 text-sm cursor-pointer leading-snug ${
                      item.done ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </label>
                  {canEdit && (
                    <button
                      onClick={() => handleChecklistDelete(idx)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canEdit && (
              addingItem ? (
                <div className="flex gap-2 mt-1">
                  <input
                    ref={newItemInputRef}
                    className="flex-1 h-8 rounded-md border border-input px-2 text-sm bg-background outline-none focus:border-red-500"
                    placeholder="Add an item…"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddChecklistItem();
                      if (e.key === "Escape") { setAddingItem(false); setNewChecklistItem(""); }
                    }}
                    autoFocus
                  />
                  <Button size="sm" className="h-8 bg-red-600 hover:bg-red-700 text-xs" onClick={handleAddChecklistItem}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingItem(false); setNewChecklistItem(""); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-full py-1"
                  onClick={() => setAddingItem(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add an item
                </button>
              )
            )}
          </div>

          {/* Meta info */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Created {new Date(task.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            {task.assigned_to_user_id && (
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Assigned
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
