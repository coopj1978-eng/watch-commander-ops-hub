import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Add a card
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        className="w-full rounded-md border border-red-500 bg-card p-2 text-sm outline-none resize-none shadow-sm text-foreground placeholder:text-muted-foreground"
        placeholder="Enter a title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-xs bg-red-600 hover:bg-red-700"
          onClick={handleSubmit}
          disabled={!title.trim() || isLoading}
        >
          Add card
        </Button>
        <button
          className="text-muted-foreground hover:text-foreground p-0.5"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
