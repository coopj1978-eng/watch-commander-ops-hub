import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, AlertCircle, CheckCircle2, Clock, User, Repeat } from "lucide-react";
import type { Task, ChecklistItem } from "~backend/task/types";

interface TaskCardProps {
  task: Task;
  onChecklistToggle?: (taskId: number, itemId: string, completed: boolean) => void;
  onTitleEdit?: (taskId: number, newTitle: string) => void;
  onClick?: () => void;
  compact?: boolean;
}

export default function TaskCard({ task, onChecklistToggle, onTitleEdit, onClick, compact = false }: TaskCardProps) {
  const [expandedChecklist, setExpandedChecklist] = useState(false);
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

  const handleTitleSave = (e: React.FocusEvent | React.KeyboardEvent) => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title) {
      onTitleEdit?.(task.id, trimmed);
    } else {
      setTitleValue(task.title);
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleTitleSave(e); }
    if (e.key === "Escape") { setTitleValue(task.title); setEditingTitle(false); }
  };

  const parseRRule = (rrule: string | undefined): string | null => {
    if (!rrule) return null;
    
    try {
      const freqMatch = rrule.match(/FREQ=([^;]+)/);
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
      const byDayMatch = rrule.match(/BYDAY=([^;]+)/);
      
      if (!freqMatch) return "Recurring";
      
      const freq = freqMatch[1];
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
      
      if (freq === "DAILY") {
        return interval === 1 ? "Daily" : `Every ${interval} days`;
      } else if (freq === "WEEKLY") {
        if (byDayMatch) {
          const days = byDayMatch[1].split(',').map(d => {
            const dayMap: Record<string, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };
            return dayMap[d] || d;
          }).join(", ");
          return interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`;
        }
        return interval === 1 ? "Weekly" : `Every ${interval} weeks`;
      } else if (freq === "MONTHLY") {
        return interval === 1 ? "Monthly" : `Every ${interval} months`;
      } else if (freq === "YEARLY") {
        return interval === 1 ? "Yearly" : `Every ${interval} years`;
      }
      
      return "Recurring";
    } catch (e) {
      return "Recurring";
    }
  };

  const getDueBadge = () => {
    if (!task.due_at) return null;

    const dueDate = new Date(task.due_at);
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (task.status === "Done") {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    }

    if (diffDays < 0) {
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue {Math.abs(diffDays)}d
        </Badge>
      );
    }

    if (diffDays === 0) {
      return (
        <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Due Today
        </Badge>
      );
    }

    if (diffDays <= 3) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Due in {diffDays}d
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs">
        <Calendar className="h-3 w-3 mr-1" />
        {dueDate.toLocaleDateString()}
      </Badge>
    );
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      High: "bg-red-500/10 text-red-500 border-red-500/20",
      Med: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    };
    return colors[priority] || colors.Med;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NotStarted: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      InProgress: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      Blocked: "bg-red-500/10 text-red-500 border-red-500/20",
      Done: "bg-green-500/10 text-green-500 border-green-500/20",
    };
    return colors[status] || colors.NotStarted;
  };

  const checklistProgress = task.checklist
    ? {
        completed: task.checklist.filter((item) => item.done).length,
        total: task.checklist.length,
        percentage: Math.round(
          (task.checklist.filter((item) => item.done).length / task.checklist.length) * 100
        ),
      }
    : null;

  const handleChecklistToggle = (item: ChecklistItem) => {
    if (onChecklistToggle) {
      onChecklistToggle(task.id, item.label, !item.done);
    }
  };

  if (compact) {
    const rruleDisplay = parseRRule(task.rrule);
    
    return (
      <div
        className="p-3 rounded-lg border border-border bg-card hover:border-red-600 transition-colors cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            {task.rrule && (
              <div title={rruleDisplay || "Recurring task"}>
                <Repeat className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              </div>
            )}
            {editingTitle ? (
              <input
                ref={titleInputRef}
                className="flex-1 text-sm font-medium bg-transparent border-b border-red-500 outline-none text-foreground"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                autoFocus
              />
            ) : (
              <h4
                className="font-medium text-foreground text-sm truncate"
                onDoubleClick={handleTitleDoubleClick}
                title={onTitleEdit ? "Double-click to edit" : task.title}
              >
                {task.title}
              </h4>
            )}
          </div>
          {getDueBadge()}
        </div>
        {rruleDisplay && (
          <Badge variant="outline" className="text-xs mb-2 bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20">
            <Repeat className="h-3 w-3 mr-1" />
            {rruleDisplay}
          </Badge>
        )}
        {checklistProgress && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${checklistProgress.percentage}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {checklistProgress.completed}/{checklistProgress.total}
            </span>
          </div>
        )}
      </div>
    );
  }

  const rruleDisplay = parseRRule(task.rrule);

  return (
    <div
      className="p-4 rounded-lg border border-border bg-card hover:border-red-600 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 flex-1">
          {task.rrule && (
            <div title={rruleDisplay || "Recurring task"}>
              <Repeat className="h-4 w-4 text-blue-500 flex-shrink-0 mt-1" />
            </div>
          )}
          <h4 className="font-medium text-foreground">{task.title}</h4>
        </div>
        <div className="flex items-center gap-1">
          <Badge className={getPriorityColor(task.priority)} variant="outline">
            {task.priority}
          </Badge>
        </div>
      </div>

      {task.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {getDueBadge()}
        {rruleDisplay && (
          <Badge variant="outline" className="text-xs bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20">
            <Repeat className="h-3 w-3 mr-1" />
            {rruleDisplay}
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {task.category}
        </Badge>
        {task.assigned_to_user_id && (
          <Badge variant="outline" className="text-xs">
            <User className="h-3 w-3 mr-1" />
            Assigned
          </Badge>
        )}
      </div>

      {task.checklist && task.checklist.length > 0 && (
        <div className="mt-3 space-y-2">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedChecklist(!expandedChecklist);
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Checklist ({checklistProgress?.completed}/{checklistProgress?.total})
              </span>
              {checklistProgress && checklistProgress.percentage > 0 && (
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${checklistProgress.percentage}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {expandedChecklist && (
            <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
              {task.checklist.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={() => handleChecklistToggle(item)}
                    id={`checklist-${task.id}-${idx}`}
                  />
                  <label
                    htmlFor={`checklist-${task.id}-${idx}`}
                    className={`text-xs cursor-pointer flex-1 ${
                      item.done ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </label>
                </div>
              ))}
              {task.checklist.length > 5 && (
                <p className="text-xs text-muted-foreground">+{task.checklist.length - 5} more items</p>
              )}
            </div>
          )}
        </div>
      )}

      {task.attachments && task.attachments.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          📎 {task.attachments.length} attachment{task.attachments.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
