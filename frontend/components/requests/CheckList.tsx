import { AlertTriangle, Check, Eye, Info, XCircle } from "lucide-react";
import type { shift_adjustments } from "@/client";
import { cn } from "@/lib/utils";

// The checks on a request. Colour only for problems: a passed check stays quiet.
// `soft`: a flag that doesn't stop anything shows amber, not red (booking a
// flexi, Nov 2026); only something that blocks stays red.

const LOOK = {
  ok: { Icon: Check, tone: "text-muted-foreground" },
  info: { Icon: Info, tone: "text-muted-foreground" },
  manual: { Icon: Eye, tone: "text-foreground" },
  warn: { Icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400" },
  fail: { Icon: XCircle, tone: "text-red-600 dark:text-red-400" },
} as const;

export function CheckList({ checks, soft = false }: { checks: shift_adjustments.RequestCheck[]; soft?: boolean }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {checks.map((c) => {
        const state = soft && c.state === "fail" && !c.blocks ? "warn" : c.state;
        const { Icon, tone } = LOOK[state];
        return (
          <li key={c.key} className="flex gap-2.5 px-3 py-2.5 text-sm">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{c.label}</p>
              <p className={cn("text-[13px] leading-snug", state === "fail" ? "text-red-700 dark:text-red-300" : state === "warn" ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>{c.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
