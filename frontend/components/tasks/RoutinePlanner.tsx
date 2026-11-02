import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowRight, Check, Copy, GripVertical, ImagePlus, Moon, MoreHorizontal, Plus, Repeat, Sun, Trash2, X } from "lucide-react";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useIsPhone } from "@/lib/taskUi";
import { CARD_COVERS, getCoverStyle } from "@/lib/taskLabels";
import { DAY_NAMES, RULE_OPTIONS, ruleLabel } from "@/lib/routineRules";
import { RoutineHeader } from "@/components/tasks/RoutineHeader";
import type { TaskTemplate } from "~backend/task/types";

// The weekly routine (Nov 2026). A station's routine changes every day but
// repeats each week, as on the Blue Watch Trello board: each day has its own
// cards — "Monday weekly checks", "Monday monthly checks" (1st Monday only),
// a quarterly card in its week — each with a header that tells them apart,
// plus the start-of-shift cards done every shift. Each card is a template on
// the server; the watch on duty gets the cards due that shift on the board.

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

interface PlanCard {
  /** The template id as a string, or a made-up key until the first save comes back. */
  key: string;
  id?: number;
  name: string;
  rule: string;
  cover: string | null;
  items: string[];
}
type DragState = { slot: string; card: string; idx: number } | null;
type OverState = { slot: string; card: string; idx: number | null } | null;

/** The slot the watch on duty is working now: a night belongs to the day it started. */
function currentSlot(now = new Date()): string {
  const h = now.getHours();
  const d = new Date(now);
  if (h < 8) d.setDate(d.getDate() - 1);
  const day = DAYS[(d.getDay() + 6) % 7].key;
  return `${day}-${h >= 8 && h < 18 ? "day" : "night"}`;
}

const newKey = () => `new-${Math.random().toString(36).slice(2, 10)}`;

function defaultName(slot: string, existing: PlanCard[]): string {
  if (slot === "every") return existing.length ? "Start of shift – Crew" : "Start of shift";
  const [d, shift] = slot.split("-");
  return `${DAY_NAMES[d]}${shift === "night" ? " night" : ""} ${existing.length ? "monthly" : "weekly"} checks`;
}

/** A picked picture, made small enough to store as the card header. */
function shrinkPicture(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That isn't a picture we can use"));
      img.onload = () => {
        const w = 640, h = 240;
        const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
        const ctx = canvas.getContext("2d")!;
        const scale = Math.max(w / img.width, h / img.height);
        ctx.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  /** Opens the other scheduled checks (fortnightly, every few months…). */
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
  const serverSlots = useMemo(() => {
    const m = new Map<string, PlanCard[]>();
    const sorted = [...templates].filter((t) => t.routine_slot)
      .sort((a, b) => (a.routine_position ?? 0) - (b.routine_position ?? 0) || a.id - b.id);
    for (const t of sorted) {
      const list = m.get(t.routine_slot!) ?? [];
      list.push({
        key: String(t.id), id: t.id, name: t.name, rule: t.routine_rule ?? "weekly", cover: t.cover ?? null,
        items: (t.checklist ?? []).map((i) => i.label),
      });
      m.set(t.routine_slot!, list);
    }
    return m;
  }, [templates]);
  const otherChecks = templates.filter((t) => !t.routine_slot && !t.reference_no).length;

  // Edits show at once and save in order, one slot at a time; each save sends
  // the slot as it is by then, and new cards get their ids from the reply.
  const [draft, setDraft] = useState<Record<string, PlanCard[]>>({});
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const chains = useRef<Record<string, Promise<void>>>({});
  useEffect(() => { if (open) setDraft({}); }, [open]);
  const cardsOf = (slot: string): PlanCard[] => draft[slot] ?? serverSlots.get(slot) ?? [];

  const save = (slot: string, cards: PlanCard[]) => {
    const next = { ...draftRef.current, [slot]: cards };
    draftRef.current = next;
    setDraft(next);
    chains.current[slot] = (chains.current[slot] ?? Promise.resolve()).then(async () => {
      const latest = draftRef.current[slot] ?? [];
      try {
        const res = await backend.task.saveRoutine(slot, {
          cards: latest.map((c) => ({ key: c.key, id: c.id, name: c.name, rule: c.rule, cover: c.cover, items: c.items })),
        });
        const ids = new Map(res.keys.map((k) => [k.key, k.id]));
        const withIds = (draftRef.current[slot] ?? []).map((c) => (c.id || !ids.has(c.key) ? c : { ...c, id: ids.get(c.key) }));
        draftRef.current = { ...draftRef.current, [slot]: withIds };
        setDraft(draftRef.current);
        qc.setQueryData(["task-templates"], (old: TaskTemplate[] | undefined) =>
          old ? [...old.filter((t) => t.routine_slot !== slot), ...(res.cards as unknown as TaskTemplate[])] : old);
        qc.invalidateQueries({ queryKey: ["tasks"] });
      } catch (e) {
        const { [slot]: _, ...rest } = draftRef.current;
        draftRef.current = rest;
        setDraft(rest);
        qc.invalidateQueries({ queryKey: ["task-templates"] });
        toast({ title: "Couldn't save the routine", description: (e as Error).message, variant: "destructive" });
      }
    });
  };
  const patchCard = (slot: string, key: string, patch: Partial<PlanCard>) =>
    save(slot, cardsOf(slot).map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const addCard = (slot: string) => {
    const cards = cardsOf(slot);
    save(slot, [...cards, { key: newKey(), name: defaultName(slot, cards), rule: cards.length && slot !== "every" ? "first" : "weekly", cover: null, items: [] }]);
  };
  const removeCard = (slot: string, key: string) => {
    const before = cardsOf(slot);
    const gone = before.find((c) => c.key === key);
    save(slot, before.filter((c) => c.key !== key));
    if (gone) {
      toast({
        title: `Removed "${gone.name}"`,
        duration: 10_000,
        action: <ToastAction altText="Undo" onClick={() => save(slot, [...cardsOf(slot), { ...gone, id: undefined, key: newKey() }])}>Undo</ToastAction>,
      });
    }
  };
  const copyCard = (slot: string, key: string, toSlot: string) => {
    const card = cardsOf(slot).find((c) => c.key === key);
    if (!card) return;
    const [fromDay] = slot.split("-");
    const [toDay] = toSlot.split("-");
    const name = card.name.replace(DAY_NAMES[fromDay] ?? "\u0000", DAY_NAMES[toDay] ?? "");
    save(toSlot, [...cardsOf(toSlot), { ...card, key: newKey(), id: undefined, name }]);
    toast({ title: `Copied to ${DAY_NAMES[toDay]}` });
  };
  const addItem = (slot: string, key: string, label: string) => {
    const card = cardsOf(slot).find((c) => c.key === key);
    if (!card) return;
    if (card.items.some((i) => i.toLowerCase() === label.toLowerCase())) {
      toast({ title: "Already there", description: `"${label}" is already on this card.` });
      return;
    }
    patchCard(slot, key, { items: [...card.items, label] });
  };
  const removeItem = (slot: string, key: string, idx: number) => {
    const card = cardsOf(slot).find((c) => c.key === key);
    if (card) patchCard(slot, key, { items: card.items.filter((_, i) => i !== idx) });
  };

  // Drag an item onto another card (any day), or onto an item to go before it.
  const [drag, setDrag] = useState<DragState>(null);
  const [over, setOver] = useState<OverState>(null);
  const drop = (slot: string, cardKey: string, beforeIdx: number | null) => {
    const from = drag;
    setDrag(null); setOver(null);
    if (!from) return;
    const src = cardsOf(from.slot).find((c) => c.key === from.card);
    const label = src?.items[from.idx];
    if (!src || label === undefined) return;
    if (from.slot === slot && from.card === cardKey) {
      const items = src.items.filter((_, i) => i !== from.idx);
      const at = Math.max(0, Math.min(items.length, beforeIdx === null ? items.length : beforeIdx > from.idx ? beforeIdx - 1 : beforeIdx));
      items.splice(at, 0, label);
      if (items.join("\n") !== src.items.join("\n")) patchCard(slot, cardKey, { items });
      return;
    }
    const dest = cardsOf(slot).find((c) => c.key === cardKey);
    if (!dest) return;
    if (dest.items.some((i) => i.toLowerCase() === label.toLowerCase())) {
      toast({ title: "Already there", description: `"${label}" is already on that card.` });
      return;
    }
    const items = [...dest.items];
    items.splice(beforeIdx ?? items.length, 0, label);
    if (from.slot === slot) {
      save(slot, cardsOf(slot).map((c) =>
        c.key === cardKey ? { ...c, items } : c.key === from.card ? { ...c, items: c.items.filter((_, i) => i !== from.idx) } : c));
    } else {
      patchCard(from.slot, from.card, { items: src.items.filter((_, i) => i !== from.idx) });
      patchCard(slot, cardKey, { items });
    }
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

  const cell = (slot: string, opts: { title?: React.ReactNode; row?: boolean; minHeight?: number }) => (
    <SlotCell
      key={slot}
      slot={slot}
      cards={cardsOf(slot)}
      canManage={canManage}
      isNow={slot === now}
      title={opts.title}
      row={opts.row}
      minHeight={opts.minHeight}
      onAddCard={() => addCard(slot)}
      onPatch={(key, patch) => patchCard(slot, key, patch)}
      onRemoveCard={(key) => removeCard(slot, key)}
      onCopyCard={(key, to) => copyCard(slot, key, to)}
      onAddItem={(key, label) => addItem(slot, key, label)}
      onRemoveItem={(key, idx) => removeItem(slot, key, idx)}
      onUploadError={(msg) => toast({ title: msg, variant: "destructive" })}
      drag={drag}
      over={over}
      onDragStart={(card, idx) => setDrag({ slot, card, idx })}
      onDragEnd={() => { setDrag(null); setOver(null); }}
      onDragOver={(card, idx) => setOver({ slot, card, idx })}
      onDrop={(card, idx) => drop(slot, card, idx)}
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
          position: "relative", width: isPhone ? "100%" : "min(1440px, 100%)", maxHeight: isPhone ? "94vh" : "calc(100vh - 40px)",
          display: "flex", flexDirection: "column", background: "var(--cal-bg)", outline: "none",
          borderRadius: isPhone ? "28px 28px 0 0" : 28, boxShadow: "var(--cal-pop)", overflow: "hidden",
        }}
      >
        <header style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: isPhone ? "16px 16px 12px" : "22px 28px 16px", background: "var(--cal-surface)", borderBottom: "1px solid var(--cal-line)" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="cal-mono" style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--cal-muted)" }}>
              Station routine · repeats every week{canManage ? "" : " · view only"}
            </span>
            <h2 id="rp-title" style={{ margin: 0, fontSize: isPhone ? 24 : 30, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.1 }}>Weekly routine</h2>
            {!isPhone && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--cal-ink-2)", maxWidth: 820 }}>
                Each day can have several cards — weekly, plus monthly or quarterly ones that only come round in their week. Whichever watch is on duty gets the cards due that shift, and ticks show who did each item.
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
              {cell("every", {
                row: !isPhone,
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
                      const n = cardsOf(`${d.key}-day`).length + cardsOf(`${d.key}-night`).length;
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
                  {SHIFTS.map((s) => cell(`${phoneDay}-${s.key}`, { title: <ShiftTitle shift={s} />, minHeight: 100 }))}
                  <button type="button" onClick={onOpenOtherChecks} className="cal-btn" style={{ height: 48, fontSize: 14 }}>
                    <Repeat className="h-4 w-4" /> Other checks{otherChecks ? ` (${otherChecks})` : ""}
                  </button>
                </>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "84px repeat(7, minmax(0, 1fr))", gap: 8, alignItems: "start" }}>
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
                      {DAYS.map((d) => cell(`${d.key}-${s.key}`, { minHeight: s.key === "day" ? 160 : 90 }))}
                    </Fragment>
                  ))}
                </div>
              )}

              <p style={{ margin: 0, fontSize: 13, color: "var(--cal-muted)", maxWidth: 860 }}>
                {canManage
                  ? `Changes save as you go and reach today's cards straight away (ticks are kept). ${isPhone ? "" : "Drag an item to move it to another card. "}Use a card's ⋯ to set how often it comes round, change its header or copy it to another day. Anything not done when the shift ends is marked missed and shows on the WC dashboard.`
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

interface CellProps {
  slot: string;
  cards: PlanCard[];
  canManage: boolean;
  isNow: boolean;
  title?: React.ReactNode;
  row?: boolean;
  minHeight?: number;
  onAddCard: () => void;
  onPatch: (key: string, patch: Partial<PlanCard>) => void;
  onRemoveCard: (key: string) => void;
  onCopyCard: (key: string, toSlot: string) => void;
  onAddItem: (key: string, label: string) => void;
  onRemoveItem: (key: string, idx: number) => void;
  onUploadError: (msg: string) => void;
  drag: DragState;
  over: OverState;
  onDragStart: (card: string, idx: number) => void;
  onDragEnd: () => void;
  onDragOver: (card: string, idx: number | null) => void;
  onDrop: (card: string, idx: number | null) => void;
}

/** One day + shift (or every shift): its cards and an "Add card" button. */
function SlotCell(p: CellProps) {
  const isPhone = useIsPhone();
  return (
    <section
      aria-label={p.slot === "every" ? "Every shift" : p.slot}
      style={{
        display: "flex", flexDirection: "column", gap: 8, padding: 8, borderRadius: 16, minHeight: p.minHeight,
        background: "var(--cal-surface-2)", border: "1px solid var(--cal-line)",
        boxShadow: p.isNow ? "0 0 0 2px var(--cal-brand)" : undefined,
      }}
    >
      {(p.title || p.isNow) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>{p.title}</div>
          {p.isNow && <span className="cal-mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--cal-brand-text)" }}>NOW</span>}
        </div>
      )}
      <div style={{ display: p.row ? "grid" : "flex", gridTemplateColumns: p.row ? "repeat(auto-fill, minmax(280px, 1fr))" : undefined, flexDirection: "column", gap: 8 }}>
        {p.cards.map((c) => (
          <CardEditor key={c.key} {...p} card={c} />
        ))}
      </div>
      {p.cards.length === 0 && !p.canManage && (
        <span style={{ fontSize: 12, color: "var(--cal-muted)", padding: "2px 4px" }}>Nothing set.</span>
      )}
      {p.canManage && (
        <button
          type="button"
          onClick={p.onAddCard}
          className="cal-focus"
          style={{
            alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, height: isPhone ? 40 : 30, padding: "0 8px", borderRadius: 9,
            border: "1px dashed var(--cal-line-2)", background: "transparent", color: "var(--cal-ink-2)", font: "inherit", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
            marginTop: "auto",
          }}
        >
          <Plus className="h-3.5 w-3.5" /> {p.cards.length ? "Add card" : p.slot === "every" ? "Add every-shift card" : "Add card"}
        </button>
      )}
    </section>
  );
}

/** A routine card: header, name, ⋯ (how often, header, copy, delete), and its items. */
function CardEditor({ slot, card, canManage, onPatch, onRemoveCard, onCopyCard, onAddItem, onRemoveItem, onUploadError, drag, over, onDragStart, onDragEnd, onDragOver, onDrop }: CellProps & { card: PlanCard }) {
  const isPhone = useIsPhone();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(card.name);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!renaming) setName(card.name); }, [card.name, renaming]);

  const every = slot === "every";
  const [dayKey] = slot.split("-");
  const dayName = DAY_NAMES[dayKey] ?? "";
  const coverStyle = getCoverStyle(card.cover ?? undefined);
  const commitItem = (keepOpen: boolean) => {
    const label = text.trim();
    if (label) onAddItem(card.key, label);
    setText("");
    if (!keepOpen) setAdding(false);
  };
  const commitName = () => {
    const n = name.trim();
    if (n && n !== card.name) onPatch(card.key, { name: n });
    setRenaming(false);
  };
  const dropOnCard = !!drag && over?.slot === slot && over.card === card.key && over.idx === null;

  return (
    <article
      onDragOver={(e) => { if (!drag || !canManage) return; e.preventDefault(); if (!(over?.slot === slot && over.card === card.key)) onDragOver(card.key, null); }}
      onDrop={(e) => { e.preventDefault(); onDrop(card.key, over?.slot === slot && over.card === card.key ? over.idx : null); }}
      style={{
        display: "flex", flexDirection: "column", gap: 6, padding: 6, borderRadius: 14, background: "var(--cal-surface)",
        boxShadow: dropOnCard ? "0 0 0 2px var(--cal-brand)" : "var(--cal-shadow)",
      }}
    >
      {coverStyle
        ? <div aria-hidden style={{ ...coverStyle, height: 48, borderRadius: 10 }} />
        : <RoutineHeader slot={slot} rule={card.rule} name={card.name} height={48} radius={10} />}

      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 2px" }}>
        {renaming ? (
          <input
            autoFocus
            aria-label="Card name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setName(card.name); setRenaming(false); } }}
            className="cal-field"
            style={{ flex: 1, height: 30, fontSize: 13, fontWeight: 600 }}
          />
        ) : (
          <button
            type="button"
            disabled={!canManage}
            onClick={() => setRenaming(true)}
            title={canManage ? "Rename" : undefined}
            style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "transparent", padding: "2px 0", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--cal-ink)", cursor: canManage ? "text" : "default", overflowWrap: "anywhere" }}
          >
            {card.name}
          </button>
        )}
        {canManage && (
          <Menu.Root>
            <Menu.Trigger asChild>
              <button type="button" aria-label={`More for ${card.name}`} className="cal-focus" style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: "var(--cal-muted)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0, flex: "none" }}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={4} collisionPadding={12} className="cal-menu" style={{ zIndex: 70, minWidth: 250, maxHeight: "70vh", overflowY: "auto" }}>
                {!every && (
                  <>
                    <MenuHeading>How often</MenuHeading>
                    {RULE_OPTIONS.map((o) => (
                      <Menu.Item key={o.rule} className="cal-menu-item" onSelect={() => onPatch(card.key, { rule: o.rule })}>
                        <span style={{ width: 16, display: "inline-grid", placeItems: "center" }}>{card.rule === o.rule && <Check className="h-3.5 w-3.5" />}</span>
                        {o.label(dayName)}
                      </Menu.Item>
                    ))}
                  </>
                )}
                <MenuHeading>Header</MenuHeading>
                <Menu.Item className="cal-menu-item" onSelect={() => onPatch(card.key, { cover: null })}>
                  <span style={{ width: 16, display: "inline-grid", placeItems: "center" }}>{!card.cover && <Check className="h-3.5 w-3.5" />}</span>
                  Automatic — {every ? "every shift" : `${dayName}, ${ruleLabel(card.rule, dayKey).toLowerCase()}`}
                </Menu.Item>
                <Menu.Item className="cal-menu-item" onSelect={() => fileRef.current?.click()}>
                  <ImagePlus className="h-3.5 w-3.5" /> Use a picture…
                </Menu.Item>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 12px 8px" }}>
                  {CARD_COVERS.filter((c) => c.id && !c.id.startsWith("grad")).map((c) => (
                    <Menu.Item
                      key={c.id}
                      onSelect={() => onPatch(card.key, { cover: c.id })}
                      aria-label={`${c.name} header`}
                      style={{ width: 22, height: 22, borderRadius: 6, background: c.bg, cursor: "pointer", outline: card.cover === c.id ? "2px solid var(--cal-ink)" : "none", outlineOffset: 2 }}
                    />
                  ))}
                </div>
                {!every && (
                  <Menu.Sub>
                    <Menu.SubTrigger className="cal-menu-item"><Copy className="h-3.5 w-3.5" /> Copy card to…</Menu.SubTrigger>
                    <Menu.Portal>
                      <Menu.SubContent className="cal-menu" sideOffset={4} collisionPadding={12} style={{ zIndex: 71 }}>
                        {DAYS.filter((d) => d.key !== dayKey).map((d) => (
                          <Menu.Item key={d.key} className="cal-menu-item" onSelect={() => onCopyCard(card.key, `${d.key}${slot.slice(2)}`)}>{d.long}</Menu.Item>
                        ))}
                      </Menu.SubContent>
                    </Menu.Portal>
                  </Menu.Sub>
                )}
                <Menu.Item className="cal-menu-item" onSelect={() => onRemoveCard(card.key)} style={{ color: "var(--cal-station-fg)" }}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete card
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try { onPatch(card.key, { cover: await shrinkPicture(f) }); } catch (err) { onUploadError((err as Error).message); }
          }}
        />
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        {card.items.map((label, idx) => {
          const dragging = drag?.slot === slot && drag.card === card.key && drag.idx === idx;
          const before = !!drag && over?.slot === slot && over.card === card.key && over.idx === idx && !dragging;
          return (
            <li
              key={`${idx}-${label}`}
              className="rp-item"
              draggable={canManage && !isPhone}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(card.key, idx); }}
              onDragEnd={onDragEnd}
              onDragOver={(e) => { if (!drag) return; e.preventDefault(); e.stopPropagation(); onDragOver(card.key, idx); }}
              style={{
                display: "flex", alignItems: "center", gap: 4, borderRadius: 8, padding: "0 2px 0 2px", minHeight: isPhone ? 38 : 28,
                opacity: dragging ? 0.4 : 1, boxShadow: before ? "0 -2px 0 var(--cal-brand)" : undefined,
                cursor: canManage && !isPhone ? "grab" : undefined,
              }}
            >
              {canManage && !isPhone
                ? <GripVertical aria-hidden className="h-3.5 w-3.5" style={{ color: "var(--cal-line-2)", flex: "none" }} />
                : <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--cal-ink-2)", margin: "0 5px", flex: "none" }} />}
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.3, overflowWrap: "anywhere", padding: "3px 0" }}>{label}</span>
              {canManage && (
                <button
                  type="button"
                  aria-label={`Remove "${label}"`}
                  onClick={() => onRemoveItem(card.key, idx)}
                  className="rp-del cal-focus"
                  style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: "var(--cal-muted)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0, flex: "none" }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          );
        })}
        {card.items.length === 0 && !adding && (
          <li style={{ fontSize: 12, color: "var(--cal-muted)", padding: "2px 6px" }}>No checks yet — the card won't go on the board until it has some.</li>
        )}
      </ul>

      {canManage && (adding ? (
        <input
          autoFocus
          aria-label="New check"
          placeholder="e.g. BA sets 1029 & 1030"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitItem(true); }
            if (e.key === "Escape") { e.preventDefault(); setText(""); setAdding(false); }
          }}
          onBlur={() => commitItem(false)}
          className="cal-field"
          style={{ height: 32, width: "100%", fontSize: 12.5 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="cal-focus"
          style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, height: isPhone ? 38 : 26, padding: "0 6px", borderRadius: 8, border: "none", background: "transparent", color: "var(--cal-ink-2)", font: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
        >
          <Plus className="h-3 w-3" /> Add check
        </button>
      ))}
    </article>
  );
}

function MenuHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--cal-muted)", padding: "8px 12px 4px" }}>
      {children}
    </div>
  );
}
