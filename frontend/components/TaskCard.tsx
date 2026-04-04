import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertCircle, CheckCircle2, Clock, Repeat } from "lucide-react";
import type { Task } from "~backend/task/types";
import { getLabelById, getCoverStyle } from "@/lib/taskLabels";

interface TaskCardProps {
  task: Task;
  onChecklistToggle?: (taskId: number, itemId: string, completed: boolean) => void;
  onTitleEdit?: (taskId: number, newTitle: string) => void;
  onClick?: () => void;
  compact?: boolean;
  isDark?: boolean;
  userMap?: Record<string, { initials: string; colour: string }>;
}

function avatarColour(userId: string): string {
  const colours = ["#6366f1","#8b5cf6","#ec4899","#f97316","#14b8a6","#0ea5e9","#22c55e","#eab308"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colours[Math.abs(hash) % colours.length];
}

export default function TaskCard({ task, onChecklistToggle, onTitleEdit, onClick, compact = false, isDark, userMap }: TaskCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    if (!onTitleEdit) return;
    e.stopPropagation();
    setTitleValue(task.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 10);
  };

  const handleTitleSave = () => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title) onTitleEdit?.(task.id, trimmed);
    else setTitleValue(task.title);
    setEditingTitle(false);
  };

  const parseRRule = (rrule?: string): string | null => {
    if (!rrule) return null;
    try {
      const freqMatch = rrule.match(/FREQ=([^;]+)/);
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
      const byDayMatch = rrule.match(/BYDAY=([^;]+)/);
      if (!freqMatch) return "Recurring";
      const freq = freqMatch[1];
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
      if (freq === "DAILY") return interval === 1 ? "Daily" : `Every ${interval} days`;
      if (freq === "WEEKLY") {
        if (byDayMatch) {
          const days = byDayMatch[1].split(",").map((d) => (({ MO:"Mon",TU:"Tue",WE:"Wed",TH:"Thu",FR:"Fri",SA:"Sat",SU:"Sun" } as Record<string,string>)[d] ?? d)).join(", ");
          return interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`;
        }
        return interval === 1 ? "Weekly" : `Every ${interval} weeks`;
      }
      if (freq === "MONTHLY") return interval === 1 ? "Monthly" : `Every ${interval} months`;
      return "Recurring";
    } catch { return "Recurring"; }
  };

  const getDueBadge = () => {
    if (!task.due_at) return null;
    const dueDate = new Date(task.due_at);
    const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
    if (task.status === "Done") return (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" />Completed
      </Badge>
    );
    if (diffDays < 0) return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
        <AlertCircle className="h-3 w-3 mr-1" />Overdue {Math.abs(diffDays)}d
      </Badge>
    );
    if (diffDays === 0) return (
      <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">
        <Clock className="h-3 w-3 mr-1" />Due Today
      </Badge>
    );
    if (diffDays <= 3) return (
      <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">
        <Clock className="h-3 w-3 mr-1" />Due in {diffDays}d
      </Badge>
    );
    return (
      <Badge variant="outline" className="text-xs">
        <Calendar className="h-3 w-3 mr-1" />
        {dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </Badge>
    );
  };

  const cardLabels = (task.tags ?? []).map(getLabelById).filter(Boolean);
  const coverStyle = getCoverStyle((task as any).cover_colour);
  const rruleDisplay = parseRRule(task.rrule);
  const checklistProgress = task.checklist && task.checklist.length > 0
    ? { completed: task.checklist.filter((i) => i.done).length, total: task.checklist.length }
    : null;
  const assignee = task.assigned_to_user_id
    ? (userMap?.[task.assigned_to_user_id] ?? { initials: task.assigned_to_user_id.slice(0, 2).toUpperCase(), colour: avatarColour(task.assigned_to_user_id) })
    : null;

  const cardBase = isDark
    ? "bg-white/95 border-white/20 hover:bg-white shadow-md"
    : "bg-card border-border hover:border-indigo-400 hover:shadow-md";

  return (
    <div
      className={`rounded-xl border transition-all cursor-pointer ${cardBase}`}
      onClick={onClick}
    >
      {/* Card cover */}
      {coverStyle && (
        <div
          className="w-full rounded-t-xl"
          style={{ ...coverStyle, height: 80 }}
        />
      )}

      {/* Colour label strips (shown below cover, or at top if no cover) */}
      {cardLabels.length > 0 && (
        <div className={`flex gap-1 px-2.5 flex-wrap ${coverStyle ? "pt-2" : "pt-2.5"}`}>
          {cardLabels.map((label) => label && (
            <div
              key={label.id}
              className="h-2 rounded-full flex-1 min-w-[2rem] max-w-[4rem]"
              style={{ backgroundColor: label.colour }}
              title={label.name}
            />
          ))}
        </div>
      )}

      <div className="p-3">
        {/* Title */}
        <div className="flex items-start gap-1.5 mb-1.5" onClick={(e) => e.stopPropagation()}>
          {task.rrule && <Repeat className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" title={rruleDisplay ?? "Recurring"} />}
          {editingTitle ? (
            <input
              ref={titleInputRef}
              className="flex-1 text-sm font-medium bg-transparent border-b border-indigo-500 outline-none"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") { setTitleValue(task.title); setEditingTitle(false); }
              }}
              autoFocus
            />
          ) : (
            <h4
              className="font-medium text-sm leading-snug line-clamp-2 flex-1"
              onDoubleClick={handleTitleDoubleClick}
              title={onTitleEdit ? "Double-click to edit" : task.title}
            >
              {task.title}
            </h4>
          )}
        </div>

        {/* Recurrence badge */}
        {rruleDisplay && (
          <div className="mb-1.5">
            <Badge variant="outline" className="text-xs bg-blue-500/5 text-blue-600 border-blue-500/20">
              <Repeat className="h-3 w-3 mr-1" />{rruleDisplay}
            </Badge>
          </div>
        )}

        {/* Due badge */}
        {task.due_at && <div className="mb-1.5">{getDueBadge()}</div>}

        {/* Checklist progress */}
        {checklistProgress && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${Math.round((checklistProgress.completed / checklistProgress.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{checklistProgress.completed}/{checklistProgress.total}</span>
          </div>
        )}

        {/* Footer: priority + avatar */}
        <div className="flex items-center justify-between gap-1 mt-1">
          <Badge
            variant="outline"
            className={`text-xs ${
              task.priority === "High" ? "text-red-500 border-red-300 bg-red-50" :
              task.priority === "Med"  ? "text-orange-500 border-orange-300 bg-orange-50" :
                                         "text-blue-500 border-blue-300 bg-blue-50"
            }`}
          >
            {task.priority}
          </Badge>
          {assignee && (
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
              style={{ backgroundColor: assignee.colour }}
              title={assignee.initials}
            >
              {assignee.initials}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
