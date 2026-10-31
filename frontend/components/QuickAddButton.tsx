import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "@/App";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  FileHeart,
  KanbanSquare,
  NotebookPen,
  Plus,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// QuickAddButton — phones only. A "+" above the bottom bar that opens a sheet
// of the few things people add on the move. Each action lands on the right
// page with its form already open (?new=1 deep links), so it's two taps from
// anywhere instead of navigate → find the button → tap.
//
// Hidden on the Tasks page, which has its own Create Task button in the same
// spot.
// ──────────────────────────────────────────────────────────────────────────────

interface Action {
  label: string;
  hint: string;
  to: string;
  Icon: LucideIcon;
  tint: string;
}

const MANAGER_ACTIONS: Action[] = [
  { label: "Task for this shift", hint: "A card on the shift board", to: "/tasks?new=1", Icon: KanbanSquare, tint: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { label: "Handover note", hint: "For the next watch", to: "/handover?tab=handover&new=1", Icon: NotebookPen, tint: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  { label: "Calendar event", hint: "Station, watch or personal", to: "/calendar?new=1", Icon: CalendarPlus, tint: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  { label: "Crewing", hint: "Who's riding what", to: "/handover", Icon: Truck, tint: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
];

const CREW_ACTIONS: Action[] = [
  { label: "Task for this shift", hint: "A card on the shift board", to: "/tasks?new=1", Icon: KanbanSquare, tint: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { label: "Calendar event", hint: "On your personal calendar", to: "/calendar?new=1", Icon: CalendarPlus, tint: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  { label: "Leave or sick line", hint: "Request leave, attach a sick line", to: "/?tab=absence", Icon: FileHeart, tint: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
];

export function QuickAddButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isManager = user?.role === "WC" || user?.role === "CC";
  const actions = isManager ? MANAGER_ACTIONS : CREW_ACTIONS;

  if (pathname.startsWith("/tasks")) return null;

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Add something"
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
            "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-background px-4 pt-3 shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200",
          )}
          style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" aria-hidden />
          <div className="mb-2 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">Add</Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Pick what to add</Dialog.Description>
          <ul className="grid gap-1.5">
            {actions.map(({ label, hint, to, Icon, tint }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => go(to)}
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
