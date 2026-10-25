import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowRightLeft, CalendarDays, Check, ChevronRight, ClipboardCheck, History, MoreHorizontal, Repeat } from "lucide-react";
import type { Task, TaskColumn, TaskPriority } from "~backend/task/types";
import { getCoverStyle, getLabelById } from "@/lib/taskLabels";
import { ChecklistBar, DueChip, Initials, LabelTag, PriorityChip, describeRRule, priorityKey, priorityLabel, useIsPhone } from "@/lib/taskUi";

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
  /** Card count per column ("4" or "4/3" with a WIP limit) for the phone "Move to…" list. */
  columnCounts?: Record<string, string>;
  onMove?: (statusKey: string) => void;
  onSetPriority?: (priority: TaskPriority) => void;
  onDelete?: () => void;
  /** Start of the shift being shown — earlier unfinished tasks show "Carried from …". */
  shiftStart?: string;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "High", label: "High" },
  { value: "Med", label: "Medium" },
  { value: "Low", label: "Low" },
];

type MenuProps = {
  task: Task;
  columns: TaskColumn[];
  columnCounts?: Record<string, string>;
  onOpen?: () => void;
  onMove: (statusKey: string) => void;
  onSetPriority?: (priority: TaskPriority) => void;
  onDelete?: () => void;
};

/** Phone: the ⋯ actions as a bottom sheet (Open, Move to…, Set priority, Delete, Cancel). */
function CardActionSheet({ task, columns, columnCounts, onOpen, onMove, onSetPriority, onDelete, onClose }: MenuProps & { onClose: () => void }) {
  const [priorityOpen, setPriorityOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const item: React.CSSProperties = {
    height: 52, border: "none", background: "transparent", borderRadius: 12, textAlign: "left", padding: "0 12px",
    font: "inherit", fontSize: 16, color: "var(--cal-ink)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", width: "100%",
  };
  const act = (fn?: () => void) => () => { onClose(); fn?.(); };

  return createPortal(
    // Portal content still bubbles React events to the card — stop them here.
    <div className="cal-ui" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,12,24,.45)" }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for ${task.title}`}
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88vh", overflowY: "auto", background: "var(--cal-surface)",
          borderRadius: "28px 28px 0 0", padding: "10px 16px calc(20px + env(safe-area-inset-bottom))",
          display: "flex", flexDirection: "column", gap: 4, boxShadow: "var(--cal-pop)",
        }}
      >
        <span aria-hidden style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, background: "var(--cal-line-2)", marginBottom: 10 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 12px", borderBottom: "1px solid var(--cal-line)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", flex: "none", background: `var(--cal-${priorityKey(task.priority)}-dot)` }} />
          <span style={{ fontSize: 16, fontWeight: 600, flex: 1, minWidth: 0 }}>{task.title}</span>
          {task.due_at && <DueChip task={task} />}
        </div>
        {onOpen && <button type="button" className="cal-focus" style={item} onClick={act(onOpen)}>Open</button>}
        <div role="radiogroup" aria-label="Move to" style={{ display: "flex", flexDirection: "column", padding: 6, borderRadius: 16, background: "var(--cal-surface-2)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cal-muted)", letterSpacing: ".06em", textTransform: "uppercase", padding: "8px 10px 4px" }}>Move to…</span>
          {columns.map((c) => {
            const on = c.status_key === task.status;
            const count = columnCounts?.[c.status_key];
            const [n, limit] = (count ?? "").split("/").map(Number);
            const over = !!limit && n > limit;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                className="cal-focus"
                onClick={act(on ? undefined : () => onMove(c.status_key))}
                style={{ ...item, ...(on ? { background: "var(--cal-surface)", fontWeight: 600, boxShadow: "var(--cal-shadow)" } : {}) }}
              >
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flex: "none" }} />
                {c.name}
                {count && (
                  <span className="cal-mono" style={{ marginLeft: "auto", fontSize: 12, padding: "2px 7px", borderRadius: 7, ...(over ? { background: "var(--cal-station-bg)", color: "var(--cal-station-fg)" } : { background: "var(--cal-surface-2)", color: "var(--cal-ink-2)" }) }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {onSetPriority && (
          <>
            <button type="button" className="cal-focus" style={item} aria-expanded={priorityOpen} onClick={() => setPriorityOpen(!priorityOpen)}>
              Set priority<span style={{ marginLeft: "auto", fontSize: 13, color: "var(--cal-muted)" }}>{priorityLabel(task.priority)}</span>
            </button>
            {priorityOpen && (
              <div role="radiogroup" aria-label="Priority" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, padding: "0 6px 6px" }}>
                {PRIORITIES.map((p) => {
                  const on = p.value === task.priority;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className="cal-focus"
                      onClick={act(on ? undefined : () => onSetPriority(p.value))}
                      style={{
                        height: 44, borderRadius: 12, font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        border: on ? "2px solid var(--cal-ink)" : "1px solid var(--cal-line-2)",
                        background: `var(--cal-${priorityKey(p.value)}-bg)`, color: `var(--cal-${priorityKey(p.value)}-fg)`,
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        {onDelete && (
          <button type="button" className="cal-focus" style={{ ...item, fontWeight: 600, color: "var(--cal-station-fg)" }} onClick={act(onDelete)}>Delete</button>
        )}
        <button
          type="button"
          className="cal-focus"
          onClick={onClose}
          style={{ height: 52, borderRadius: 14, border: "1px solid var(--cal-line-2)", background: "var(--cal-surface)", color: "var(--cal-ink)", font: "inherit", fontSize: 16, fontWeight: 500, marginTop: 4, cursor: "pointer" }}
        >
          Cancel
        </button>
      </section>
    </div>,
    document.body
  );
}

function CardMenu(props: MenuProps) {
  const { task, columns, onOpen, onMove, onSetPriority, onDelete } = props;
  const isPhone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  // "Move to column…" and "Set priority" open in place (easier on a phone than fly-outs).
  const [section, setSection] = useState<"move" | "priority" | null>(null);
  const toggle = (e: Event, s: "move" | "priority") => { e.preventDefault(); setSection(section === s ? null : s); };
  const chevron = (open: boolean) => (
    <ChevronRight className="h-3.5 w-3.5" style={{ marginLeft: "auto", transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }} />
  );

  const triggerStyle: React.CSSProperties = {
    marginLeft: "auto", width: isPhone ? 36 : 28, height: isPhone ? 36 : 28, borderRadius: isPhone ? 10 : 8, border: "none",
    background: "transparent", color: "var(--cal-muted)", display: "grid", placeItems: "center", cursor: "pointer", flex: "none", padding: 0,
  };

  // Phones get a bottom sheet, opened on a full tap (Radix opens on pointer-down,
  // which would let the same tap land on the sheet's backdrop and close it).
  if (isPhone) {
    return (
      <>
        <button
          type="button"
          aria-label="Card actions"
          aria-haspopup="dialog"
          className="cal-focus"
          onClick={(e) => { e.stopPropagation(); setSheetOpen(true); }}
          onKeyDown={(e) => e.stopPropagation()}
          style={triggerStyle}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </button>
        {sheetOpen && <CardActionSheet {...props} onClose={() => setSheetOpen(false)} />}
      </>
    );
  }

  return (
    <Menu.Root onOpenChange={(open) => { if (!open) setSection(null); }}>
      <Menu.Trigger asChild>
        <button
          type="button"
          aria-label="Card actions"
          className="cal-focus"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={triggerStyle}
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

const FREQ_LABEL: Record<string, string> = {
  shift: "Every shift", daily: "Daily", weekly: "Weekly", fortnightly: "Fortnightly",
  monthly: "Monthly", quarterly: "Quarterly", repeat: "Repeating",
};

const tagStyle = (bg: string, fg: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 8px", borderRadius: 7,
  fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: bg, color: fg,
});

/** What the card is on the shift board: a station check, carried over, or from the calendar. */
function ShiftTag({ task, shiftStart }: { task: Task & { kind?: string; check_freq?: string; handover_from?: string }; shiftStart?: string }) {
  const due = task.due_at ? new Date(task.due_at) : null;
  const short = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (task.kind === "handover") {
    const waiting = task.status !== "Done" && due && shiftStart && due < new Date(shiftStart);
    return (
      <>
        <span style={tagStyle("var(--cal-insp-bg)", "var(--cal-insp-fg)")} title="Handed over by an earlier shift — stays until someone does it">
          <ArrowRightLeft className="h-3 w-3" /> Handover{task.handover_from ? ` · ${task.handover_from}` : ""}
        </span>
        {waiting && <span className="cal-mono" style={tagStyle("var(--cal-surface-2)", "var(--cal-ink-2)")}>Waiting since {short(due!)}</span>}
      </>
    );
  }
  if (task.kind === "check") {
    const long = ["weekly", "fortnightly", "monthly", "quarterly"].includes(task.check_freq ?? "");
    return (
      <>
        <span style={tagStyle("var(--cal-brand-soft)", "var(--cal-brand-text)")}>
          <ClipboardCheck className="h-3 w-3" /> Station check · {FREQ_LABEL[task.check_freq ?? ""] ?? "Repeating"}
        </span>
        {long && due && task.status !== "Done" && (
          <span className="cal-mono" style={tagStyle("var(--cal-surface-2)", "var(--cal-ink-2)")}>
            Due by {short(new Date(due.getTime() - 60_000))}
          </span>
        )}
      </>
    );
  }
  if (task.status !== "Done" && due && shiftStart && due < new Date(shiftStart)) {
    return (
      <span style={tagStyle("var(--cal-day-bg)", "var(--cal-day-fg)")} title="Not finished on an earlier shift">
        <History className="h-3 w-3" /> Carried from {short(due)}
      </span>
    );
  }
  if (task.kind === "calendar") {
    const time = due && (due.getHours() || due.getMinutes()) ? ` · ${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}` : "";
    return (
      <span style={tagStyle("var(--cal-watch-bg)", "var(--cal-watch-fg)")}>
        <CalendarDays className="h-3 w-3" /> Calendar{time}
      </span>
    );
  }
  return null;
}

export default function TaskCard({ task, onTitleEdit, onClick, userMap, columns, columnCounts, onMove, onSetPriority, onDelete, shiftStart }: TaskCardProps) {
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
  const shiftTask = task as Task & { kind?: string; check_freq?: string; completed_by_name?: string };
  const tag = shiftTask.kind ? <ShiftTag task={shiftTask} shiftStart={shiftStart} /> : null;
  // On the shift board the tag says when it's for, so the due chip is only kept for plain watch tasks.
  const showDue = !!task.due_at && (!shiftTask.kind || (shiftTask.kind === "watch" && !(shiftStart && new Date(task.due_at) < new Date(shiftStart))));
  const menu = onMove && columns && columns.length > 0
    ? <CardMenu task={task} columns={columns} columnCounts={columnCounts} onOpen={onClick} onMove={onMove} onSetPriority={onSetPriority} onDelete={onDelete} />
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

      {(labelIds.length > 0 || tag) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {tag}
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
        {recur && shiftTask.kind !== "check" && (
          <span role="img" aria-label={`Recurring: ${recur}`} title={recur} style={{ display: "inline-flex", flex: "none", marginTop: 2, color: "var(--cal-brand-text)" }}>
            <Repeat className="h-[15px] w-[15px]" />
          </span>
        )}
        {labelIds.length === 0 && !tag && menu && <span style={{ marginTop: -4, display: "flex" }}>{menu}</span>}
      </div>

      <ChecklistBar task={task} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {done && shiftTask.completed_by_name ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--cal-leave-fg)" }}>
            <Check className="h-3 w-3" strokeWidth={3} /> {shiftTask.completed_by_name}
          </span>
        ) : showDue ? (
          <DueChip task={task} />
        ) : recur && !shiftTask.kind ? (
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
