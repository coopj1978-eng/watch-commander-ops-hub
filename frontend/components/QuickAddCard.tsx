import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";

interface QuickAddCardProps {
  columnStatusKey: string;
  onAdd: (title: string, statusKey: string) => void;
  isLoading?: boolean;
}

export default function QuickAddCard({ columnStatusKey, onAdd, isLoading }: QuickAddCardProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, columnStatusKey);
    setTitle("");
    // Keep open for rapid entry
    textareaRef.current?.focus();
  };

  const handleCancel = () => {
    setOpen(false);
    setTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") handleCancel();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cal-focus"
        style={{
          display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 10px", borderRadius: 12,
          border: "none", background: "transparent", color: "var(--cal-ink-2)", font: "inherit", fontSize: 13,
          fontWeight: 500, cursor: "pointer",
        }}
      >
        <Plus className="h-4 w-4" />
        Add a card
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        ref={textareaRef}
        aria-label="New card title"
        placeholder="Enter a title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        style={{
          width: "100%", borderRadius: 14, border: "2px solid var(--cal-brand)", background: "var(--cal-surface)",
          padding: 10, font: "inherit", fontSize: 14, color: "var(--cal-ink)", outline: "none", resize: "none",
          boxShadow: "var(--cal-shadow)", boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim() || isLoading}
          className="cal-focus"
          style={{
            height: 36, padding: "0 14px", borderRadius: 10, border: "none", background: "var(--cal-brand)", color: "#fff",
            font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !title.trim() || isLoading ? 0.5 : 1,
          }}
        >
          Add card
        </button>
        <button type="button" aria-label="Cancel" className="cal-btn" style={{ width: 36, height: 36, padding: 0 }} onClick={handleCancel}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
