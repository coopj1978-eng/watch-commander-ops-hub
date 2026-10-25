import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

interface QuickAddCardProps {
  columnStatusKey: string;
  onAdd: (title: string, statusKey: string) => void;
  isLoading?: boolean;
  /** Optional control from outside (the column header's "+" opens it). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const kbd: React.CSSProperties = { padding: "1px 5px", borderRadius: 5, background: "var(--cal-surface-2)" };

export default function QuickAddCard({ columnStatusKey, onAdd, isLoading, open: openProp, onOpenChange }: QuickAddCardProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed || isLoading) return;
    onAdd(trimmed, columnStatusKey);
    setTitle("");
    // Keep open for rapid entry
    inputRef.current?.focus();
  };

  const handleCancel = () => {
    setOpen(false);
    setTitle("");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cal-focus"
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", height: 44, padding: "0 12px", borderRadius: 14,
          border: "none", background: "transparent", color: "var(--cal-ink-2)", font: "inherit", fontSize: 14,
          fontWeight: 500, cursor: "pointer",
        }}
      >
        <Plus className="h-4 w-4" strokeWidth={2.2} />
        Add a card
      </button>
    );
  }

  // Enter adds and stays open for the next one; Esc (or leaving it empty) closes.
  return (
    <div style={{ background: "var(--cal-surface)", borderRadius: 16, padding: 10, boxShadow: "0 0 0 2px var(--cal-brand)", display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        ref={inputRef}
        aria-label="New card title"
        placeholder="Card title…"
        value={title}
        enterKeyHint="done"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
          if (e.key === "Escape") handleCancel();
        }}
        onBlur={() => { if (!title.trim()) handleCancel(); }}
        style={{ border: "none", background: "transparent", font: "inherit", fontSize: 14, color: "var(--cal-ink)", outline: "none", padding: 4 }}
      />
      <span style={{ fontSize: 11, color: "var(--cal-muted)" }}>
        <span className="cal-mono" style={kbd}>Enter</span> to add · <span className="cal-mono" style={kbd}>Esc</span> to cancel
      </span>
    </div>
  );
}
