import { useState, useRef } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, MoreHorizontal, Repeat } from "lucide-react";
import type { Task, TaskColumn, TaskPriority } from "~backend/task/types";
import { getCoverStyle, getLabelById } from "@/lib/taskLabels";
import { ChecklistBar, DueChip, Initials, LabelTag, PriorityChip, describeRRule, priorityKey } from "@/lib/taskUi";

// Board card in the Claude Design Tasks layout: label tags + ⋯ menu on top,
// priority dot and title, checklist bar, then due / priority / initials.

interface TaskCardProps {
  task: Task;
  onChecklistToggle?: (taskId: number, itemId: string, completed: boolean) => void;
  onTitleEdit?: (taskId: number, newTitle: string) => void;
  onClick?: () => void;
  compact?: boolean;
  isDark?: boolean;
  userMap?: Record<string, { initials: string; colour: string }>;
  /** ⋯ menu actions — the menu only shows when onMove is given. */
  columns?: TaskColumn[];
  onMove?: (statusKey: string) => void;
  onSetPriority?: (priority: TaskPriority) => void;
  onDelete?: () => void;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "High", label: "High" },
  { value: "Med", label: "Medium" },
  { value: "Low", label: "Low" },
];

function CardMenu({
  task, columns, onOpen, onMove, onSetPriority, onDelete,
}: {
  task: Task;
  columns: TaskColumn[];
  onOpen?: () => void;
  onMove: (statusKey: string) => void;
  onSetPriority?: (priority: TaskPriority) => void;
  onDelete?: () => void;
}) {
  // "Move to column…" and "Set priority" open in place (easier on a phone than fly-outs).
  const [section, setSection] = useState<"move" | "priority" | null>(null);
  const toggle = (e: Event, s: "move" | "priority") => { e.preventDefault(); setSection(section === s ? null : s); };
  const chevron = (open: boolean) => (
    <ChevronRight className="h-3.5 w-3.5" style={{ marginLeft: "auto", transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }} />
  );

  return (
    <Menu.Root onOpenChange={(open) => { if (!open) setSection(null); }}>
      <Menu.Trigger asChild>
        <button
          type="button"
          aria-label="Card actions"
          className="cal-focus"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            marginLeft: "auto", width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent",
            color: "var(--cal-muted)", display: "grid", placeItems: "center", cursor: "pointer", flex: "none", padding: 0,
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        {/* Portal content still bubbles React events to the card — stop them. */}
        <Menu.Content
          align="end"
          sideOffset={4}
          collisionPadding={12}
          className="cal-menu"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {onOpen && <Menu.Item className="cal-menu-item" onSelect={onOpen}>Open</Menu.Item>}

          <Menu.Item className="cal-menu-item" aria-expanded={section === "move"} onSelect={(e) => toggle(e, "move")}>
            Move to column…{chevron(section === "move")}
          </Menu.Item>
          {section === "move" && (
            <Menu.RadioGroup value={task.status} onValueChange={onMove}>
              {columns.map((c) => (
                <Menu.RadioItem key={c.id} value={c.status_key} className="cal-menu-item cal-menu-sub">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flex: "none" }} />
                  {c.name}
                  <Menu.ItemIndicator style={{ marginLeft: "auto", display: "flex" }}>
                    <Check className="h-3.5 w-3.5" style={{ color: "var(--cal-brand-text)" }} />
                  </Menu.ItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          )}

          {onSetPriority && (
            <>
              <Menu.Item className="cal-menu-item" aria-expanded={section === "priority"} onSelect={(e) => toggle(e, "priority")}>
                Set priority{chevron(section === "priority")}
              </Menu.Item>
              {section === "priority" && (
                <Menu.RadioGroup value={task.priority} onValueChange={(v) => onSetPriority(v as TaskPriority)}>
                  {PRIORITIES.map((p) => (
                    <Menu.RadioItem key={p.value} value={p.value} className="cal-menu-item cal-menu-sub">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: `var(--cal-${priorityKey(p.value)}-dot)`, flex: "none" }} />
                      {p.label}
                      <Menu.ItemIndicator style={{ marginLeft: "auto", display: "flex" }}>
                        <Check className="h-3.5 w-3.5" style={{ color: "var(--cal-brand-text)" }} />
                      </Menu.ItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              )}
            </>
          )}

          {onDelete && (
            <>
              <Menu.Separator className="cal-menu-sep" />
              <Menu.Item className="cal-menu-item cal-menu-danger" onSelect={onDelete}>Delete</Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export default function TaskCard({ task, onTitleEdit, onClick, userMap, columns, onMove, onSetPriority, onDelete }: TaskCardProps) {
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

  const labelIds = (task.tags ?? []).filter((id) => getLabelById(id));
  const coverStyle = getCoverStyle((task as any).cover_colour);
  const recur = describeRRule(task.rrule);
  const assignee = task.assigned_to_user_id
    ? { id: task.assigned_to_user_id, initials: userMap?.[task.assigned_to_user_id]?.initials ?? task.assigned_to_user_id.slice(0, 2).toUpperCase() }
    : null;
  const done = task.status === "Done";
  const menu = onMove && columns && columns.length > 0
    ? <CardMenu task={task} columns={columns} onOpen={onClick} onMove={onMove} onSetPriority={onSetPriority} onDelete={onDelete} />
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={task.title}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" && !editingTitle) onClick?.(); }}
      className="cal-focus"
      style={{
        background: "var(--cal-surface)", borderRadius: 16, boxShadow: "var(--cal-card-shadow)",
        padding: coverStyle ? "8px 12px 12px" : "12px 12px 12px 14px",
        display: "flex", flexDirection: "column", gap: 9, cursor: "pointer", color: "var(--cal-ink)",
        ...(done ? { opacity: 0.85 } : {}),
      }}
    >
      {coverStyle && <div style={{ ...coverStyle, height: 92, borderRadius: 11, margin: "0 -4px" }} />}

      {labelIds.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {labelIds.map((id) => <LabelTag key={id} id={id} />)}
          {menu}
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
            style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 14, fontWeight: 600, background: "transparent", border: "none", borderBottom: "2px solid var(--cal-brand)", outline: "none", color: "var(--cal-ink)" }}
          />
        ) : (
          <h4
            onDoubleClick={handleTitleDoubleClick}
            title={onTitleEdit ? "Double-click to edit" : task.title}
            style={{
              margin: 0, flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              ...(done ? { textDecoration: "line-through", color: "var(--cal-ink-2)" } : {}),
            }}
          >
            {task.title}
          </h4>
        )}
        {recur && (
          <span role="img" aria-label={`Recurring: ${recur}`} title={recur} style={{ display: "inline-flex", flex: "none", marginTop: 2, color: "var(--cal-brand-text)" }}>
            <Repeat className="h-[15px] w-[15px]" />
          </span>
        )}
        {labelIds.length === 0 && menu && <span style={{ marginTop: -4, display: "flex" }}>{menu}</span>}
      </div>

      <ChecklistBar task={task} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {task.due_at ? (
          <DueChip task={task} />
        ) : recur ? (
          <span className="cal-mono" style={{ fontSize: 11, color: "var(--cal-muted)" }}>{recur}</span>
        ) : null}
        <PriorityChip priority={task.priority} />
        {assignee && (
          <span style={{ marginLeft: "auto", display: "flex" }}>
            <Initials userId={assignee.id} initials={assignee.initials} />
          </span>
        )}
      </div>
    </div>
  );
}
