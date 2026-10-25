import { useState } from "react";
import { CheckCircle2, Info, ListTodo, Plus, X } from "lucide-react";
import type { handover } from "@/client";

type Item = handover.HandoverItem;

// Handover lines (Oct 2026): short notes for the watch coming on.
//   Needs doing — becomes a card on the shift board for whoever is on duty
//                 until someone does it (kitbag to another station, a call).
//   For info    — shown on the next watch's board until they mark it read,
//                 or to every watch until a date (a road closure).

export const HANDOVER_TAGS: { id: string; label: string }[] = [
  { id: "incident", label: "Incident" },
  { id: "equipment", label: "Equipment" },
  { id: "road", label: "Road" },
  { id: "call", label: "Call to make" },
  { id: "staff", label: "Staff" },
];
export const tagLabel = (id?: string) => HANDOVER_TAGS.find((t) => t.id === id)?.label;

const chip = (on: boolean): React.CSSProperties => ({
  height: 30, padding: "0 10px", borderRadius: 999, font: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 5,
  ...(on
    ? { background: "var(--cal-brand-soft)", color: "var(--cal-brand-text)", border: "1px solid var(--cal-brand)" }
    : { background: "var(--cal-surface)", color: "var(--cal-ink-2)", border: "1px solid var(--cal-line-2)" }),
});

export function KindBadge({ kind }: { kind: Item["kind"] }) {
  return kind === "action" ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px", borderRadius: 7, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: "var(--cal-day-bg)", color: "var(--cal-day-fg)" }}>
      <ListTodo className="h-3 w-3" /> Needs doing
    </span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px", borderRadius: 7, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: "var(--cal-watch-bg)", color: "var(--cal-watch-fg)" }}>
      <Info className="h-3 w-3" /> For info
    </span>
  );
}

export default function HandoverItemsEditor({ items, onChange }: { items: Item[]; onChange: (items: Item[]) => void }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Item["kind"]>("action");
  const [tag, setTag] = useState<string | undefined>();
  const [until, setUntil] = useState("");

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { kind, tag, text: t, show_until: kind === "info" && until ? until : undefined }]);
    setText("");
    setTag(undefined);
    setUntil("");
  };
  const update = (i: number, patch: Partial<Item>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));

  return (
    <div className="cal-ui" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it, i) => {
            const done = it.task_status === "Done";
            return (
              <li key={it.id ?? `new-${i}`} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", borderRadius: 12, border: "1px solid var(--cal-line)", background: "var(--cal-surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => update(i, { kind: it.kind === "action" ? "info" : "action" })}
                    title="Switch between Needs doing and For info"
                    disabled={done}
                    style={{ border: "none", background: "transparent", padding: 0, cursor: done ? "default" : "pointer" }}
                  >
                    <KindBadge kind={it.kind} />
                  </button>
                  {it.tag && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cal-muted)" }}>{tagLabel(it.tag) ?? it.tag}</span>}
                  {done && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--cal-leave-fg)" }}>
                      <CheckCircle2 className="h-3 w-3" /> Done{it.done_by_name ? ` by ${it.done_by_name}` : ""}
                    </span>
                  )}
                  <button type="button" aria-label="Remove line" onClick={() => remove(i)} className="cal-focus" style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: "var(--cal-muted)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  aria-label="Handover line"
                  value={it.text}
                  disabled={done}
                  onChange={(e) => update(i, { text: e.target.value })}
                  className="cal-field"
                  style={{ width: "100%", boxSizing: "border-box", fontSize: 14, background: "var(--cal-surface)" }}
                />
                {it.kind === "info" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--cal-muted)" }}>
                    Keep showing to every watch until
                    <input type="date" value={it.show_until ?? ""} onChange={(e) => update(i, { show_until: e.target.value || undefined })} className="cal-field" style={{ height: 32, fontSize: 12 }} />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* New line */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 14, border: "2px dashed var(--cal-line-2)" }}>
        <div role="radiogroup" aria-label="Type of line" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" role="radio" aria-checked={kind === "action"} onClick={() => setKind("action")} className="cal-focus" style={chip(kind === "action")}>
            <ListTodo className="h-3.5 w-3.5" /> Needs doing
          </button>
          <button type="button" role="radio" aria-checked={kind === "info"} onClick={() => setKind("info")} className="cal-focus" style={chip(kind === "info")}>
            <Info className="h-3.5 w-3.5" /> For info
          </button>
          <span style={{ width: 1, height: 20, background: "var(--cal-line-2)", alignSelf: "center", margin: "0 2px" }} />
          {HANDOVER_TAGS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tag === t.id} onClick={() => setTag(tag === t.id ? undefined : t.id)} className="cal-focus" style={{ ...chip(tag === t.id), fontWeight: 500 }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            aria-label="New handover line"
            placeholder={kind === "action" ? "e.g. FF Smith's kitbag to Stn 12 for his next shift" : "e.g. A82 closed at the bridge until Friday"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            className="cal-field"
            style={{ flex: 1, minWidth: 0, fontSize: 14, background: "var(--cal-surface)" }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!text.trim()}
            className="cal-focus"
            style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "none", background: "var(--cal-brand)", color: "#fff", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: text.trim() ? 1 : 0.5 }}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        {kind === "info" && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--cal-muted)", flexWrap: "wrap" }}>
            Keep showing to every watch until (optional)
            <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="cal-field" style={{ height: 32, fontSize: 12 }} />
          </label>
        )}
        <span style={{ fontSize: 11, color: "var(--cal-muted)" }}>
          {kind === "action"
            ? "Goes on the board for whoever is on duty next, and stays until someone does it."
            : "Shows on the next watch's Tasks page until they mark it read."}
        </span>
      </div>
    </div>
  );
}
