import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { useNav } from "@/lib/navigation";

// ──────────────────────────────────────────────────────────────────────────────
// QuickAddButton — phones only. A "+" above the bottom bar that opens a sheet
// of the few things people add on the move. Each action lands on the right
// page with its form already open (?new=1 deep links), so it's two taps from
// anywhere instead of navigate → find the button → tap.
//
// Hidden on the Tasks page, which has its own Create Task button in the same
// spot.
// ──────────────────────────────────────────────────────────────────────────────

export function QuickAddButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { actions } = useNav();

  // Pages with a tick list down the right of the screen.
  if (pathname.startsWith("/tasks") || pathname.startsWith("/hydrants")) return null;

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
