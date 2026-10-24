import { useState, useRef } from "react";
import { Repeat } from "lucide-react";
import type { Task } from "~backend/task/types";
import { getLabelById, getCoverStyle } from "@/lib/taskLabels";
import { ChecklistBar, DueChip, PriorityChip, describeRRule, priorityKey } from "@/lib/taskUi";

// Board card in the v2 design (calendar tokens): soft rounded card with a
// priority dot, label pills, due/recurrence chips, checklist bar and the
// assignee's initials.

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
  const colours = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#0ea5e9", "#22c55e", "#eab308"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colours[Math.abs(hash) % colours.length];
}

export default function TaskCard({ task, onTitleEdit, onClick, userMap }: TaskCardProps) {
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

  const cardLabels = (task.tags ?? []).map(getLabelById).filter(Boolean);
  const coverStyle = getCoverStyle((task as any).cover_colour);
  const recur = describeRRule(task.rrule);
  const assignee = task.assigned_to_user_id
    ? (userMap?.[task.assigned_to_user_id] ?? {
        initials: task.assigned_to_user_id.slice(0, 2).toUpperCase(),
        colour: avatarColour(task.assigned_to_user_id),
      })
    : null;
  const done = task.status === "Done";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" && !editingTitle) onClick?.(); }}
      className="cal-focus"
      style={{
        background: "var(--cal-surface)", border: "1px solid var(--cal-line)", borderRadius: 14,
        boxShadow: "var(--cal-shadow)", cursor: "pointer", overflow: "hidden", color: "var(--cal-ink)",
      }}
    >
      {coverStyle && <div style={{ ...coverStyle, height: 64 }} />}

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {cardLabels.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {cardLabels.map((label) => label && (
              <span
                key={label.id}
                title={label.name}
                style={{ height: 6, borderRadius: 999, flex: "1 1 2rem", maxWidth: "4rem", minWidth: "2rem", background: label.colour }}
              />
            ))}
          </div>
        )}

        {/* As before: clicks on the title don't open the task, so a
            double-click can edit the title in place. */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }} onClick={(e) => (onTitleEdit || editingTitle) && e.stopPropagation()}>
          <span
            aria-hidden
            title={`${task.priority === "Med" ? "Medium" : task.priority} priority`}
            style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 6, flex: "none", background: `var(--cal-${priorityKey(task.priority)}-dot)` }}
          />
          {editingTitle ? (
            <input
              ref={titleInputRef}
              aria-label="Task title"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") { setTitleValue(task.title); setEditingTitle(false); }
              }}
              autoFocus
              style={{ flex: 1, font: "inherit", fontSize: 14, fontWeight: 600, background: "transparent", border: "none", borderBottom: "2px solid var(--cal-brand)", outline: "none", color: "var(--cal-ink)" }}
            />
          ) : (
            <h4
              onDoubleClick={handleTitleDoubleClick}
              title={onTitleEdit ? "Double-click to edit" : task.title}
              style={{
                margin: 0, flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.3,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                ...(done ? { color: "var(--cal-muted)" } : {}),
              }}
            >
              {task.title}
            </h4>
          )}
          {recur && (
            <span title={recur} style={{ display: "inline-flex", flex: "none", marginTop: 2, color: "var(--cal-watch-dot)" }}>
              <Repeat className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        {(task.due_at || recur) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <DueChip task={task} />
            {recur && !task.due_at && <span className="cal-mono" style={{ fontSize: 11, color: "var(--cal-muted)" }}>{recur}</span>}
          </div>
        )}

        <ChecklistBar task={task} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <PriorityChip priority={task.priority} />
          {assignee && (
            <span
              title={assignee.initials}
              className="cal-mono"
              style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", color: "#fff", fontSize: 10.5, fontWeight: 600, background: assignee.colour, flex: "none" }}
            >
              {assignee.initials}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
