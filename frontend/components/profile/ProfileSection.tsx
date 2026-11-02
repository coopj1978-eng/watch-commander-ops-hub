import type { ReactNode } from "react";
import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

// A card on a person's profile that's edited where it sits (Nov 2026): its
// own Edit, then Save / Cancel in its header — instead of one Edit Profile
// button that opened every field on the page at once.

export function ProfileSection({
  title, description, editable, editing, saving, onEdit, onCancel, onSave, className, children,
}: {
  title: string;
  description?: ReactNode;
  editable?: boolean;
  editing?: boolean;
  saving?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card", editing ? "border-foreground/40 ring-1 ring-foreground/10" : "border-border/70", className)}>
      <header className="flex items-start gap-3 px-4 pb-2 pt-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {editing ? (
          <div className="flex shrink-0 gap-1.5">
            <button type="button" onClick={onCancel} className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted">
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-foreground px-2.5 text-xs font-medium text-background disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : editable ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${title.toLowerCase()}`}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        ) : null}
      </header>
      <div className="px-4 pb-4 sm:px-5">{children}</div>
    </section>
  );
}

/** A label / value row inside a profile section. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[40px] items-center justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right text-sm font-medium">{children}</div>
    </div>
  );
}
