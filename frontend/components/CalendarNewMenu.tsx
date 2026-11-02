import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, CalendarPlus, ClipboardPlus, GraduationCap, Plus, X, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// One "New" on the calendar (Nov 2026) in place of the three toolbar buttons
// plus the phone's separate "New event": a menu on desktop, the "+" on phones.

export type NewKind = "event" | "shift" | "inspection" | "training";

const ITEMS: { kind: NewKind; label: string; hint: string; Icon: LucideIcon; tint: string }[] = [
  { kind: "event", label: "Event", hint: "Station, watch or personal", Icon: CalendarPlus, tint: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  { kind: "shift", label: "Log shift", hint: "TOIL, H4H, flexi, orange day", Icon: CalendarDays, tint: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  { kind: "inspection", label: "Inspection", hint: "HFSV, hydrant, multi-storey, OI, care home", Icon: ClipboardPlus, tint: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  { kind: "training", label: "Training", hint: "Plan a session for the watch", Icon: GraduationCap, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
];

export function CalendarNewButton({ onPick }: { onPick: (kind: NewKind) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="cal-focus"
          style={{
            height: 40, padding: "0 16px 0 12px", borderRadius: 12, border: "none", background: "var(--cal-brand)",
            color: "#fff", font: "inherit", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center",
            gap: 6, cursor: "pointer",
          }}
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} /> New
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-64 p-1.5">
        {ITEMS.map(({ kind, label, hint, Icon, tint }) => (
          <DropdownMenuItem key={kind} onSelect={() => onPick(kind)} className="gap-3 py-2">
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tint)}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Phones: the calendar's own "+" (the app-wide one is hidden here). */
export function CalendarNewFab({ onPick, dayLabel }: { onPick: (kind: NewKind) => void; dayLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Add to the calendar"
          className={cn(
            "md:hidden print:hidden fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full",
            "bg-brand text-brand-foreground shadow-[0_10px_28px_-6px_rgba(49,46,129,0.55)]",
            "transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30",
          )}
          style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-background px-4 pt-3 shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200",
          )}
          style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" aria-hidden />
          <div className="mb-2 flex items-center justify-between">
            <div>
              <Dialog.Title className="text-base font-semibold">Add to the calendar</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">{dayLabel}</Dialog.Description>
            </div>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <ul className="grid gap-1.5">
            {ITEMS.map(({ kind, label, hint, Icon, tint }) => (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); onPick(kind); }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
                >
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tint)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
