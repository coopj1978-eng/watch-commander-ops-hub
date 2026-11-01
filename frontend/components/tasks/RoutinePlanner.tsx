import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowRight, Copy, GripVertical, Moon, MoreHorizontal, Plus, Repeat, Sun, X } from "lucide-react";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { useIsPhone } from "@/lib/taskUi";
import type { TaskTemplate } from "~backend/task/types";

// The weekly routine (Nov 2026). A station's routine changes every day but
// repeats each week, the way it's written on the station-office board:
// Monday hydrants and pump test, Tuesday ladders… plus the checks done every
// shift. Each slot here is one template on the server ('every', 'MO-day',
// 'MO-night'…); each shift the watch on duty gets one card per slot.

const DAYS = [
  { key: "MO", short: "Mon", long: "Monday" },
  { key: "TU", short: "Tue", long: "Tuesday" },
  { key: "WE", short: "Wed", long: "Wednesday" },
  { key: "TH", short: "Thu", long: "Thursday" },
  { key: "FR", short: "Fri", long: "Friday" },
  { key: "SA", short: "Sat", long: "Saturday" },
  { key: "SU", short: "Sun", long: "Sunday" },
] as const;
const SHIFTS = [
  { key: "day", label: "Day", hours: "08:00–18:00", Icon: Sun },
  { key: "night", label: "Night", hours: "18:00–08:00", Icon: Moon },
] as const;

/** The slot the watch on duty is working now: a night belongs to the day it started. */
function currentSlot(now = new Date()): string {
  const h = now.getHours();
  const d = new Date(now);
  if (h < 8) d.setDate(d.getDate() - 1);
  const day = DAYS[(d.getDay() + 6) % 7].key;
  return `${day}-${h >= 8 && h < 18 ? "day" : "night"}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  /** Opens the other scheduled checks (monthly, quarterly…). */
  onOpenOtherChecks: () => void;
}

export default function RoutinePlanner({ open, onClose, canManage, onOpenOtherChecks }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isPhone = useIsPhone();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const { data, isLoading } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => (await backend.task.listTemplates()).templates as unknown as TaskTemplate[],
    enabled: open,
  });
  const templates = data ?? [];
  const bySlot = useMemo(() => {
    const m = new Map<string, TaskTemplate>();
    for (const t of templates) if (t.routine_slot) m.set(t.routine_slot, t);
    return m;
  }, [templates]);
  const otherChecks = templates.filter((t) => !t.routine_slot).length;

  // Edits show at once; the server copy takes over when the planner reopens.
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  useEffect(() => { if (open) setDraft({}); }, [open]);
  const itemsOf = (slot: string): string[] => {
    if (draft[slot]) return draft[slot];
    const t = bySlot.get(slot);
    return t && t.is_active ? (t.checklist ?? []).map((i) => i.label) : [];
  };

  const saveMutation = useMutation({
    mutationFn: ({ slot, items }: { slot: string; items: string[] }) => backend.task.saveRoutine(slot, { items }),
    onSuccess: (res) => {
      const saved = res.template as unknown as TaskTemplate | null;
      if (saved) {
        qc.setQueryData(["task-templates"], (old: TaskTemplate[] | undefined) =>
          old ? [...old.filter((t) => t.id !== saved.id), saved] : old);
      }
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error, { slot }) => {
      setDraft((d) => { const next = { ...d }; delete next[slot]; return next; });
      toast({ title: "Couldn't save the routine", description: e.message, variant: "destructive" });
    },
  });
  const save = (slot: string, items: string[]) => {
    setDraft((d) => ({ ...d, [slot]: items }));
    saveMutation.mutate({ slot, items });
  };
  const add = (slot: string, label: string) => {
    const items = itemsOf(slot);
    if (items.some((i) => i.toLowerCase() === label.toLowerCase())) {
      toast({ title: "Already there", description: `"${label}" is already on this list.` });
      return;
    }
    save(slot, [...items, label]);
  };
  const remove = (slot: string, idx: number) => save(slot, itemsOf(slot).filter((_, i) => i !== idx));
  const copyTo = (from: string, to: string) => {
    const target = itemsOf(to);
    const extra = itemsOf(from).filter((i) => !target.some((t) => t.toLowerCase() === i.toLowerCase()));
    if (extra.length === 0) return toast({ title: "Nothing new to copy" });
    save(to, [...target, ...extra]);
    toast({ title: `Copied ${extra.length} item${extra.length === 1 ? "" : "s"}` });
  };

  // Drag an item to another day / shift, or onto an item to go before it.
  const [drag, setDrag] = useState<{ slot: string; idx: number } | null>(null);
  const [over, setOver] = useState<{ slot: string; idx: number | null } | null>(null);
  const drop = (slot: string, beforeIdx: number | null) => {
    if (!drag) return;
    const label = itemsOf(drag.slot)[drag.idx];
    setDrag(null); setOver(null);
    if (label === undefined) return;
    if (drag.slot === slot) {
      const items = itemsOf(slot).filter((_, i) => i !== drag.idx);
      let at = beforeIdx === null ? items.length : beforeIdx > drag.idx ? beforeIdx - 1 : beforeIdx;
      at = Math.max(0, Math.min(items.length, at));
      items.splice(at, 0, label);
      if (items.join("\n") !== itemsOf(slot).join("\n")) save(slot, items);
      return;
    }
    if (itemsOf(slot).some((i) => i.toLowerCase() === label.toLowerCase())) {
      toast({ title: "Already there", description: `"${label}" is already on that list.` });
      return;
    }
    const target = [...itemsOf(slot)];
    target.splice(beforeIdx ?? target.length, 0, label);
    save(drag.slot, itemsOf(drag.slot).filter((_, i) => i !== drag.idx));
    save(slot, target);
  };

  const now = currentSlot();
  const [phoneDay, setPhoneDay] = useState<string>(now.slice(0, 2));

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) onCloseRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); opener?.focus?.({ preventScroll: true }); };
  }, [open]);

  if (!open) return null;

  const cell = (slot: string, opts: { title?: React.ReactNode; wrap?: boolean; minHeight?: number }) => (
    <SlotList
      key={slot}
      slot={slot}
      items={itemsOf(slot)}
      canManage={canManage}
      isNow={slot === now || slot === "every"}
      title={opts.title}
      wrap={opts.wrap}
      minHeight={opts.minHeight}
      onAdd={(label) => add(slot, label)}
      onRemove={(idx) => remove(slot, idx)}
      copyTargets={slot === "every" ? undefined : DAYS.filter((d) => !slot.startsWith(d.key)).map((d) => ({ slot: `${d.key}${slot.slice(2)}`, label: d.long }))}
      onCopy={(to) => copyTo(slot, to)}
      drag={drag}
      over={over}
      onDragStart={(idx) => setDrag({ slot, idx })}
      onDragEnd={() => { setDrag(null); setOver(null); }}
      onDragOver={(idx) => setOver({ slot, idx })}
      onDrop={(idx) => drop(slot, idx)}
    />
  );

  return createPortal(
    <div className="cal-ui" style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: isPhone ? "end stretch" : "center", padding: isPhone ? 0 : 20 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,12,24,.5)" }} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-title"
        style={{
          position: "relative", width: isPhone ? "100%" : "min(1320px, 100%)", maxHeight: isPhone ? "94vh" : "calc(100vh - 40px)",
          display: "flex", flexDirection: "column", background: "var(--cal-bg)", outline: "none",
          borderRadius: isPhone ? "28px 28px 0 0" : 28, boxShadow: "var(--cal-pop)", overflow: "hidden",
        }}
      >
        {/* Header */}
        <header style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: isPhone ? "16px 16px 12px" : "22px 28px 16px", background: "var(--cal-surface)", borderBottom: "1px solid var(--cal-line)" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="cal-mono" style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--cal-muted)" }}>
              Station routine · repeats every week{canManage ? "" : " · view only"}
            </span>
            <h2 id="rp-title" style={{ margin: 0, fontSize: isPhone ? 24 : 30, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.1 }}>Weekly routine</h2>
            {!isPhone && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--cal-ink-2)", maxWidth: 760 }}>
                Whichever watch is on duty gets the shift's checks and that day's routine as cards on the board. Tick items on the card; it shows who did each one.
              </p>
            )}
          </div>
          {!isPhone && (
            <button type="button" onClick={onOpenOtherChecks} className="cal-btn" style={{ height: 40, padding: "0 14px", fontSize: 13 }}>
              <Repeat className="h-4 w-4" />
              Other checks{otherChecks ? ` (${otherChecks})` : ""}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" aria-label="Close" onClick={onClose} className="cal-btn" style={{ width: 40, height: 40, padding: 0, flex: "none" }}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isPhone ? 14 : "18px 28px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {isLoading ? (
            <p style={{ fontSize: 14, color: "var(--cal-muted)" }}>Loading the routine…</p>
          ) : (
            <>
              {/* Every shift */}
              {cell("every", {
                wrap: !isPhone,
                title: (
                  <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>Every shift</span>
                    <span style={{ fontSize: 12, color: "var(--cal-muted)" }}>days and nights, every day of the week</span>
                  </span>
                ),
              })}

              {isPhone ? (
                <>
                  <div role="tablist" aria-label="Day" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, padding: 4, borderRadius: 14, background: "var(--cal-surface-3)" }}>
                    {DAYS.map((d) => {
                      const on = phoneDay === d.key;
                      const n = itemsOf(`${d.key}-day`).length + itemsOf(`${d.key}-night`).length;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          role="tab"
                          aria-selected={on}
                          onClick={() => setPhoneDay(d.key)}
                          className="cal-focus"
                          style={{
                            height: 48, borderRadius: 10, border: "none", font: "inherit", fontSize: 12, cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                            ...(on ? { background: "var(--cal-surface)", color: "var(--cal-ink)", fontWeight: 700, boxShadow: "var(--cal-shadow)" } : { background: "transparent", color: "var(--cal-ink-2)", fontWeight: 500 }),
                          }}
                        >
                          {d.short}
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: n ? (now.startsWith(d.key) ? "var(--cal-brand)" : "var(--cal-ink-2)") : "transparent" }} />
                        </button>
                      );
                    })}
                  </div>
                  {SHIFTS.map((s) => cell(`${phoneDay}-${s.key}`, { title: <ShiftTitle shift={s} />, minHeight: 120 }))}
                  <button type="button" onClick={onOpenOtherChecks} className="cal-btn" style={{ height: 48, fontSize: 14 }}>
                    <Repeat className="h-4 w-4" /> Other checks{otherChecks ? ` (${otherChecks})` : ""} — monthly, quarterly…
                  </button>
                </>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "84px repeat(7, minmax(0, 1fr))", gap: 8 }}>
                  <span />
                  {DAYS.map((d) => {
                    const today = now.startsWith(d.key);
                    return (
                      <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px 2px" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: today ? "var(--cal-brand-text)" : "var(--cal-ink)" }}>{d.long}</span>
                        {today && <span className="cal-mono" style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6, background: "var(--cal-brand)", color: "#fff" }}>TODAY</span>}
                      </div>
                    );
                  })}
                  {SHIFTS.map((s) => (
                    <Fragment key={s.key}>
                      <div style={{ paddingTop: 12 }}><ShiftTitle shift={s} stacked /></div>
                      {DAYS.map((d) => cell(`${d.key}-${s.key}`, { minHeight: s.key === "day" ? 190 : 130 }))}
                    </Fragment>
                  ))}
                </div>
              )}

              <p style={{ margin: 0, fontSize: 13, color: "var(--cal-muted)", maxWidth: 820 }}>
                {canManage
                  ? "Changes save as you go and reach today's cards straight away (ticks are kept). Drag an item to move it to another day. Anything not done when the shift ends is marked missed and shows on the WC dashboard."
                  : "Only Watch and Crew Commanders can change the routine."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ShiftTitle({ shift, stacked }: { shift: (typeof SHIFTS)[number]; stacked?: boolean }) {
  const { Icon } = shift;
  const k = shift.key === "day" ? "day" : "night";
  return (
    <span style={{ display: "flex", flexDirection: stacked ? "column" : "row", alignItems: stacked ? "flex-start" : "center", gap: stacked ? 4 : 8 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 9px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: `var(--cal-${k}-bg)`, color: `var(--cal-${k}-fg)` }}>
        <Icon className="h-3.5 w-3.5" /> {shift.label}
      </span>
      <span className="cal-mono" style={{ fontSize: 11, color: "var(--cal-muted)" }}>{shift.hours}</span>
    </span>
  );
}

/** One slot's list: items (drag to move, × to remove) and an "Add" line. */
function SlotList({
  slot, items, canManage, isNow, title, wrap, minHeight, onAdd, onRemove, copyTargets, onCopy,
  drag, over, onDragStart, onDragEnd, onDragOver, onDrop,
}: {
  slot: string;
  items: string[];
  canManage: boolean;
  isNow: boolean;
  title?: React.ReactNode;
  wrap?: boolean;
  minHeight?: number;
  onAdd: (label: string) => void;
  onRemove: (idx: number) => void;
  copyTargets?: { slot: string; label: string }[];
  onCopy: (to: string) => void;
  drag: { slot: string; idx: number } | null;
  over: { slot: string; idx: number | null } | null;
  onDragStart: (idx: number) => void;
  onDragEnd: () => void;
  onDragOver: (idx: number | null) => void;
  onDrop: (idx: number | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const isPhone = useIsPhone();
  const commit = (keepOpen: boolean) => {
    const label = text.trim();
    if (label) onAdd(label);
    setText("");
    if (!keepOpen) setAdding(false);
  };
  const dropHere = !!drag && over?.slot === slot && over.idx === null;
  const nowCell = isNow && slot !== "every";

  return (
    <section
      aria-label={slot === "every" ? "Every shift" : slot}
      onDragOver={(e) => { if (!drag || !canManage) return; e.preventDefault(); if (!(over?.slot === slot)) onDragOver(null); }}
      onDrop={(e) => { e.preventDefault(); onDrop(over?.slot === slot ? over.idx : null); }}
      style={{
        position: "relative", display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 16, minHeight,
        background: "var(--cal-surface)", border: "1px solid var(--cal-line)",
        boxShadow: dropHere ? "0 0 0 2px var(--cal-brand)" : nowCell ? "0 0 0 2px var(--cal-brand), var(--cal-shadow)" : "var(--cal-shadow)",
      }}
    >
      {(title || nowCell || (canManage && copyTargets && items.length > 0)) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{title}</div>
          {nowCell && <span className="cal-mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--cal-brand-text)" }}>NOW</span>}
          {canManage && copyTargets && items.length > 0 && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <button type="button" aria-label="More for this list" className="cal-focus" style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "transparent", color: "var(--cal-muted)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content align="end" sideOffset={4} collisionPadding={12} className="cal-menu" style={{ zIndex: 70 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--cal-muted)", padding: "6px 12px 4px" }}>
                    <Copy className="h-3 w-3" style={{ display: "inline", marginRight: 6, verticalAlign: -1 }} />Copy these to…
                  </div>
                  {copyTargets.map((t) => (
                    <Menu.Item key={t.slot} className="cal-menu-item" onSelect={() => onCopy(t.slot)}>{t.label}</Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          )}
        </div>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: wrap ? "row" : "column", flexWrap: wrap ? "wrap" : undefined, gap: wrap ? 6 : 2 }}>
        {items.map((label, idx) => {
          const dragging = drag?.slot === slot && drag.idx === idx;
          const before = !!drag && over?.slot === slot && over.idx === idx && !dragging;
          return (
            <li
              key={`${idx}-${label}`}
              className="rp-item"
              draggable={canManage && !isPhone}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(idx); }}
              onDragEnd={onDragEnd}
              onDragOver={(e) => { if (!drag) return; e.preventDefault(); e.stopPropagation(); onDragOver(idx); }}
              style={{
                display: "flex", alignItems: "center", gap: 4, borderRadius: 9, padding: wrap ? "0 4px 0 10px" : "0 2px 0 4px", minHeight: wrap ? 32 : isPhone ? 40 : 30,
                background: wrap ? "var(--cal-surface-2)" : "transparent", opacity: dragging ? 0.4 : 1,
                boxShadow: before ? (wrap ? "-3px 0 0 var(--cal-brand)" : "0 -2px 0 var(--cal-brand)") : undefined,
                cursor: canManage && !isPhone ? "grab" : undefined,
              }}
            >
              {!wrap && canManage && !isPhone && <GripVertical aria-hidden className="h-3.5 w-3.5" style={{ color: "var(--cal-line-2)", flex: "none" }} />}
              {!wrap && !(canManage && !isPhone) && <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--cal-ink-2)", margin: "0 5px", flex: "none" }} />}
              <span style={{ flex: wrap ? undefined : 1, minWidth: 0, fontSize: 13, lineHeight: 1.3, overflowWrap: "anywhere", padding: "4px 0" }}>{label}</span>
              {canManage && (
                <button
                  type="button"
                  aria-label={`Remove "${label}"`}
                  onClick={() => onRemove(idx)}
                  className="rp-del cal-focus"
                  style={{ width: 24, height: 24, borderRadius: 7, border: "none", background: "transparent", color: "var(--cal-muted)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0, flex: "none" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
        {items.length === 0 && !adding && (
          <li style={{ fontSize: 12, color: "var(--cal-muted)", padding: "4px 4px" }}>
            {slot === "every" ? "No every-shift checks yet." : "Nothing set."}
          </li>
        )}
      </ul>

      {canManage && (adding ? (
        <input
          autoFocus
          aria-label="New item"
          placeholder={slot === "every" ? "e.g. BA sets checked" : "e.g. Hydrant inspections"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(true); }
            if (e.key === "Escape") { e.preventDefault(); setText(""); setAdding(false); }
          }}
          onBlur={() => commit(false)}
          className="cal-field"
          style={{ height: 34, width: wrap ? 260 : "100%", fontSize: 13 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="cal-focus"
          style={{
            alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, height: isPhone ? 40 : 30, padding: "0 8px", borderRadius: 9,
            border: "none", background: "transparent", color: "var(--cal-ink-2)", font: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer",
            marginTop: "auto",
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      ))}
    </section>
  );
}
