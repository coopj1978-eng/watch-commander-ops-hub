import type { ReactNode } from "react";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { shiftDisplay, getWatchShiftStatus } from "@/lib/shiftRota";

// The top of a person's profile (Nov 2026 redesign): who they are, where
// their watch is on the rota right now, one-tap Call / Text / Email for the
// WC on a phone, and a strip of the facts a WC checks most — each one opens
// the tab it comes from. Neutral throughout; amber and red only for things
// that need attention ("colour only for problems").

const WATCH_RING: Record<string, string> = {
  Green: "#16a34a",
  Red: "#dc2626",
  White: "#cbd5e1",
  Blue: "#2563eb",
  Amber: "#f59e0b",
};

export type FactTone = "neutral" | "warning" | "critical";

export interface ProfileFact {
  key: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: FactTone;
  onClick?: () => void;
}

export interface ProfileFlag {
  key: string;
  label: string;
  tone?: FactTone;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

export function ProfileHero({
  name, rank, watch, station, serviceNumber, phone, email, flags, facts, menu,
}: {
  name: string;
  rank?: string | null;
  watch?: string | null;
  station?: string | null;
  serviceNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  flags: ProfileFlag[];
  facts: ProfileFact[];
  /** Extra actions (e.g. the admin's invite / reset links), shown as a ⋯ menu. */
  menu?: ReactNode;
}) {
  const shift = watch ? shiftDisplay(watch) : null;
  const onShift = watch ? getWatchShiftStatus(watch)?.state === "on" : false;
  const tel = phone?.replace(/[^\d+]/g, "");

  return (
    <section aria-label={`${name}'s profile`} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            aria-hidden
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-foreground text-xl font-semibold tracking-tight text-background sm:h-20 sm:w-20 sm:text-2xl"
            style={{ boxShadow: `0 0 0 3px var(--card), 0 0 0 6px ${WATCH_RING[watch ?? ""] ?? "transparent"}` }}
          >
            {initials(name)}
          </div>
          <div className="min-w-0">
            <div className="eyebrow truncate">
              {[serviceNumber && `Service #${serviceNumber}`, station].filter(Boolean).join(" · ") || "Profile"}
            </div>
            <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
              {rank && <span className="font-medium">{rank}</span>}
              {watch && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: WATCH_RING[watch] ?? "currentColor" }} />
                  {watch} Watch
                </span>
              )}
              {shift && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {onShift && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground motion-reduce:animate-none" />}
                  <span className="font-medium text-foreground">{onShift ? `On shift · ${shift.main}` : shift.main}</span>
                  {shift.sub && <span className="hidden sm:inline">· {shift.sub}</span>}
                </span>
              )}
              {flags.map((f) => (
                <span
                  key={f.key}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    f.tone === "critical" ? "bg-red-500/10 text-red-700 dark:text-red-400"
                      : f.tone === "warning" ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      : "bg-muted text-foreground"
                  )}
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <QuickAction href={tel ? `tel:${tel}` : undefined} icon={<Phone className="h-4 w-4" />} label="Call" />
          <QuickAction href={tel ? `sms:${tel}` : undefined} icon={<MessageSquare className="h-4 w-4" />} label="Text" />
          <QuickAction href={email ? `mailto:${email}` : undefined} icon={<Mail className="h-4 w-4" />} label="Email" />
          {menu}
        </div>
      </div>

      {facts.length > 0 && (
        <dl className="flex flex-wrap gap-px border-t border-border/60 bg-border/60">
          {facts.map((f) => <Fact key={f.key} fact={f} />)}
        </dl>
      )}
    </section>
  );
}

function QuickAction({ href, icon, label }: { href?: string; icon: ReactNode; label: string }) {
  const cls = "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium md:flex-none";
  return href ? (
    <a href={href} className={cn(cls, "hover:bg-muted")}>{icon}{label}</a>
  ) : (
    <span aria-disabled className={cn(cls, "cursor-not-allowed opacity-40")} title={`No ${label === "Email" ? "email" : "phone number"} on file`}>{icon}{label}</span>
  );
}

function Fact({ fact }: { fact: ProfileFact }) {
  const body = (
    <>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{fact.label}</dt>
      <dd
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums leading-tight",
          fact.tone === "critical" ? "text-red-600 dark:text-red-400" : fact.tone === "warning" ? "text-amber-700 dark:text-amber-300" : "text-foreground"
        )}
      >
        {fact.value}
      </dd>
      {fact.sub && <dd className="mt-0.5 truncate text-xs text-muted-foreground">{fact.sub}</dd>}
    </>
  );
  const cls = cn(
    // Each fact grows to fill its row, so the 1px gaps read as dividers whatever the count.
    "relative min-w-0 flex-[1_1_150px] bg-card px-4 py-3 text-left",
    fact.tone && fact.tone !== "neutral" && "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r",
    fact.tone === "critical" && "before:bg-red-500",
    fact.tone === "warning" && "before:bg-amber-500"
  );
  return fact.onClick ? (
    <button type="button" onClick={fact.onClick} className={cn(cls, "transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none")}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
