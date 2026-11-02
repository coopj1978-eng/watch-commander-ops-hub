import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DriverPathwayStatus } from "~backend/profile/types";

// The driver pathway as the steps it is (Nov 2026), from the medical to
// passed ERD, instead of a status dropdown: where they are, what's done and
// what's next. When editing, tap a step to move them to it.

export const DRIVER_STEPS: { value: DriverPathwayStatus; label: string }[] = [
  { value: "medical_due", label: "Medical due" },
  { value: "application_sent", label: "Application sent" },
  { value: "awaiting_theory", label: "Awaiting theory" },
  { value: "awaiting_course", label: "Awaiting course" },
  { value: "passed_LGV", label: "Passed LGV" },
  { value: "awaiting_ERD", label: "Awaiting ERD" },
  { value: "passed", label: "Passed" },
];

export function DriverPathway({
  status, lgvPassedDate, editing, onPick, onDate,
}: {
  status?: DriverPathwayStatus | null;
  lgvPassedDate?: string | null;
  editing: boolean;
  onPick: (s: DriverPathwayStatus) => void;
  onDate: (d: string) => void;
}) {
  const at = DRIVER_STEPS.findIndex((s) => s.value === status);
  const lgvDone = at >= 4;

  if (at < 0 && !editing) {
    return <p className="text-sm text-muted-foreground">Not on the driver pathway.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-7 gap-1" aria-label="Driver pathway">
        {DRIVER_STEPS.map((s, i) => {
          const done = at >= 0 && i < at;
          const current = i === at;
          const Step = editing ? "button" : "div";
          return (
            <li key={s.value} className="min-w-0">
              <Step
                {...(editing ? { type: "button" as const, onClick: () => onPick(s.value), "aria-pressed": current } : {})}
                aria-current={current ? "step" : undefined}
                className={cn("group flex w-full flex-col items-center gap-1.5 text-center", editing && "cursor-pointer")}
              >
                <span className="relative flex w-full items-center">
                  <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : done || current ? "bg-foreground" : "bg-border")} />
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-semibold",
                      done && "border-foreground bg-foreground text-background",
                      current && "border-foreground bg-background text-foreground ring-4 ring-foreground/10",
                      !done && !current && "border-border bg-background text-muted-foreground",
                      editing && !current && "group-hover:border-foreground"
                    )}
                  >
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cn("h-0.5 flex-1", i === DRIVER_STEPS.length - 1 ? "bg-transparent" : done ? "bg-foreground" : "bg-border")} />
                </span>
                <span className={cn("hidden text-[11px] leading-tight sm:block", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {s.label}
                </span>
              </Step>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          <span className="text-muted-foreground">Now: </span>
          <span className="font-semibold">{at >= 0 ? DRIVER_STEPS[at].label : "Not started"}</span>
          {at >= 0 && at < DRIVER_STEPS.length - 1 && (
            <span className="text-muted-foreground"> · next: {DRIVER_STEPS[at + 1].label}</span>
          )}
        </span>
        {lgvDone && (editing ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            LGV passed
            <input
              type="date"
              value={lgvPassedDate ?? ""}
              onChange={(e) => onDate(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
            />
          </label>
        ) : lgvPassedDate ? (
          <span className="text-xs text-muted-foreground">
            LGV passed {new Date(lgvPassedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        ) : null)}
      </div>
      {editing && <p className="text-[11px] text-muted-foreground">Tap a step to move them to it.</p>}
    </div>
  );
}
